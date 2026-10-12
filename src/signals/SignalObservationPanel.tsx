import { useEffect, useRef, useState } from 'react';
import { compareSavedSnapshots, loadSavedObservations, type SavedObservationBundle, type SavedObservationCandidate, type ComparisonResult } from './saved-observations';
import './signal-observations.css';

type Ready = { bundle: SavedObservationBundle; results: ComparisonResult[] };
type State = { status: 'loading' | 'error' } | ({ status: 'ready' } & Ready);
const time = (value: string) => new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
const title = (value: string) => value.replace(/<br\s*\/?\s*>/gi, ' ');
function isNavigationUrl(value: string, source: string): boolean {
  // Match the offline saved-article-links-1 policy; removal alone is not evidence of navigation.
  const url = new URL(value);
  return !value.includes('?') && !value.includes('#') && url.hostname === new URL(source).hostname
    && (/^\/news_list\/page\/[1-9][0-9]*\/?$/.test(url.pathname) || ['/news', '/news/'].includes(url.pathname));
}

export function SignalObservationPanel({ entityId, categoryId }: { entityId: string; categoryId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const focus = useRef<string | null>(null);
  useEffect(() => {
    const request = new AbortController(); let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      try {
        const bundle = await loadSavedObservations({ entityId, categoryId }, { signal: request.signal });
        const results = await Promise.all(bundle.comparisons.map(({ before, after }) => compareSavedSnapshots(before, after)));
        if (active) { setState({ status: 'ready', bundle, results }); setComparisonId(null); setSelectedId(null); }
      } catch { if (active) setState({ status: 'error' }); }
    });
    return () => { active = false; request.abort(); };
  }, [entityId, categoryId, attempt]);
  useEffect(() => {
    if (!focus.current) return;
    const target = root.current?.querySelector<HTMLElement>(focus.current);
    target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'start' }); focus.current = null;
  }, [selectedId, comparisonId]);
  if (state.status !== 'ready' || state.bundle.entityId !== entityId || state.bundle.categoryId !== categoryId) return <section className="signal-observations signal-panel" aria-label="保存観測の比較">
    <h2>公式ニュースの確認記録</h2><p role="status">{state.status !== 'error' ? '保存された2時点を確認しています。' : 'この対象で比較できる取得記録を読み込めません。'}</p>
    {state.status === 'error' ? <button className="signal-text-button" onClick={() => { setState({ status: 'loading' }); setAttempt((n) => n + 1); }}>取得記録を読み直す</button> : null}
  </section>;
  const index = Math.max(0, comparisonId ? state.bundle.comparisons.findIndex((item) => item.id === comparisonId) : state.bundle.comparisons.length - 1);
  const comparison = state.bundle.comparisons[index], result = state.results[index];
  const { before, after } = comparison;
  const derivation = comparison.reExtraction;
  // Keep archived counts unchanged, but do not present URLs proven to be navigation as article candidates.
  const navigationUrls = new Set(state.bundle.comparisons.flatMap((item) => {
    const original = state.bundle.comparisons.find((source) => source.id === item.reExtraction?.sourceComparisonId);
    if (!original) return [];
    const retained = new Set([...item.before.candidates, ...item.after.candidates].map((candidate) => candidate.url));
    return [...original.before.candidates, ...original.after.candidates].filter((candidate) => !retained.has(candidate.url) && isNavigationUrl(candidate.url, original.after.sourceUrl)).map((candidate) => candidate.url);
  }));
  const visibleCandidates = after.candidates.filter((item) => !navigationUrls.has(item.url));
  const hiddenNavigation = after.candidates.length - visibleCandidates.length;
  const additions = result.candidates.added.length, removals = result.candidates.removed.length, changes = result.candidates.changed.length;
  const unchanged = additions + removals + changes === 0;
  const article = result.articles.find((item) => item.candidateId === selectedId);
  const candidate = after.candidates.find((item) => item.id === selectedId) ?? before.candidates.find((item) => item.id === selectedId);
  const bodyKnown = result.articles.filter((item) => item.bodyChange !== 'unknown');
  const bodyChanges = bodyKnown.filter((item) => item.bodyChange !== 'unchanged');
  const articleCandidates = [...result.articles].sort((a, b) => Number(b.bodyChange === 'changed') - Number(a.bodyChange === 'changed'))
    .map((item) => after.candidates.find((candidate) => candidate.id === item.candidateId) ?? before.candidates.find((candidate) => candidate.id === item.candidateId))
    .filter((item): item is SavedObservationCandidate => Boolean(item));
  const next = [...new Map([...result.candidates.added, ...result.candidates.changed.map((item) => item.after), ...articleCandidates].filter((item) => !navigationUrls.has(item.url)).map((item) => [item.id, item])).values()].slice(0, 2);
  const choose = (id: string | null) => { focus.current = id ? '#signal-observation-detail' : `#signal-observation-open-${selectedId?.replace(/([.:])/g, '\\$1')}`; setSelectedId(id); };
  return <section ref={root} className="signal-observations" aria-label="保存観測の比較">
    <div className="signal-observation-toolbar"><span className="signal-eyebrow">公式ニュース · 2時点の確認</span>
      <label>比較する取得回<select aria-label="比較する取得回" value={comparison.id} onChange={(event) => { setComparisonId(event.target.value); setSelectedId(null); focus.current = '#signal-observation-title'; }}>{state.bundle.comparisons.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    </div>
    {derivation ? <aside className="signal-observation-reextraction" aria-label="抽出仕様の変更"><strong>保存HTMLを記事候補だけに再集計</strong><p>旧保存{derivation.after.originalSavedCount}候補 → {after.candidates.length}記事候補は抽出仕様の変更です。サイトの変化や新しい取得を示す件数ではありません。</p></aside> : hiddenNavigation ? <p className="signal-observation-legacy">旧抽出の保存記録です。保存件数は当時のまま保持し、ページ送り・記事一覧の{hiddenNavigation}件は候補表示から除いています。</p> : null}
    {selectedId && candidate ? <>
      <button className="signal-text-button signal-observation-back" onClick={() => choose(null)}>← 確認候補へ戻る</button>
      <section className="signal-panel signal-observation-detail" id="signal-observation-detail" tabIndex={-1}>
        <p className="signal-eyebrow">選んだ公式記事</p><h2>{title(candidate.title)}</h2>
        <p className="signal-observation-body-state">{!article || article.bodyChange === 'unknown' ? '記事全文の変化は未判定' : article.bodyChange === 'unchanged' ? '確認した記事の抽出本文に差はありません' : '確認した記事の抽出本文に差があります'}</p>
        <div className="signal-observation-evidence">{([['前の取得', article?.before], ['後の取得', article?.after]] as const).map(([label, source]) => <section key={label}>
          <h3>{label}</h3>{source ? <><p><time dateTime={source.retrievedAt}>{time(source.retrievedAt)}</time> UTC</p><p className="signal-subtle">{source.status !== 'ok' ? '取得失敗' : source.bodyComplete ? '抽出本文を保存' : '引用抜粋のみ。全文は未保存・未確認'}</p>
            {source.excerpt ? <blockquote>{source.excerpt}</blockquote> : <p>保存引用はありません。</p>}
            {source.body && source.bodyComplete ? <details><summary>この時点の抽出本文を見る</summary><pre>{source.body}</pre></details> : null}
          </> : <p>この時点の記事本文は保存されていません。</p>}
        </section>)}</div>
        {article?.bodyChange === 'unknown' && article.excerptChange === 'unchanged' ? <p>保存引用は同じです。全文の無変化を示すものではありません。</p> : null}
        {article?.rawChange === 'changed' ? <p className="signal-subtle">HTML全体には差があります。本文の変更と同じ意味ではありません。</p> : null}
        <p><a href={candidate.url} target="_blank" rel="noopener noreferrer">この公式ページを開く ↗</a></p>
        <p className="signal-subtle">商品の新旧関係・個別意匠との対応・AI品質は、この比較では確認していません。</p>
        <details className="signal-observation-technical"><summary>比較条件とハッシュ</summary><dl><dt>条件</dt><dd>{after.scopeLabel}</dd><dt>条件の記録</dt><dd>{derivation ? '保存HTMLを新版条件で再抽出' : result.conditionsVerified === 'recorded' ? '取得時に固定して保存' : '既存の保存条件を事後照合'}</dd><dt>条件SHA-256</dt><dd>{after.conditionsHash}</dd><dt>抽出版</dt><dd>{after.extractionVersion}</dd><dt>本文SHA-256（前 / 後）</dt><dd>{article?.before?.bodyHash ?? '未保存'} / {article?.after?.bodyHash ?? '未保存'}</dd><dt>引用SHA-256（前 / 後）</dt><dd>{article?.before?.excerptHash ?? '未保存'} / {article?.after?.excerptHash ?? '未保存'}</dd></dl></details>
      </section><button className="signal-text-button signal-observation-back" onClick={() => choose(null)}>← 確認候補へ戻る</button>
    </> : <>
      <div className="signal-observation-summary">
        <div><p className="signal-eyebrow">{state.bundle.companyName} · {state.bundle.categoryLabel}</p><h2 id="signal-observation-title" tabIndex={-1}>{!result.comparable ? 'この2時点は比較できません' : bodyChanges.length ? `確認した${bodyChanges.length}記事の抽出本文に差があります` : unchanged ? derivation ? `再抽出した${result.candidates.unchanged.length}記事候補に変化なし` : `確認した保存${result.candidates.unchanged.length}候補に変化なし` : `保存候補に変化があります`}</h2>
          <p className="signal-observation-last">最終確認 <time dateTime={after.observedAt}>{time(after.observedAt)}</time> UTC</p>
        </div><span className="signal-observation-mark" aria-hidden="true">{result.comparable && unchanged && bodyChanges.length === 0 ? '✓' : '—'}</span>
        {result.comparable ? unchanged ? null : <div className="signal-observation-counts"><span>候補入り <strong>{additions}</strong></span><span>候補外 <strong>{removals}</strong></span><span>一覧情報の差 <strong>{changes}</strong></span></div> : <p>取得条件・時刻・取得完了を確認してください。</p>}
        <p className="signal-observation-limits">確認範囲：保存 {before.candidates.length} → {after.candidates.length}候補。{before.omittedCount || after.omittedCount ? `保存対象外 ${before.omittedCount} → ${after.omittedCount}件は未比較。` : 'この入口HTML内の対象候補に保存漏れはありません。サイト全体の網羅ではありません。'}</p>
        <p className="signal-observation-body-state">{!result.comparable || bodyKnown.length === 0 ? '記事全文：未判定。保存引用と区別しています。' : `抽出本文：${bodyKnown.length}記事を比較・${bodyChanges.length ? `${bodyChanges.length}記事に差` : '差なし'}。その他の記事本文は未判定。`}</p>
      </div>
      <div className="signal-observation-next-heading"><h3>次に見る候補</h3><span>保存根拠を1件ずつ確認</span></div>
      <div className="signal-observation-next">{next.map((item, i) => <article key={item.id}><span className="signal-observation-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><div><p className="signal-eyebrow">取得記録あり · 公開日{item.publishedAt ?? '不明'}</p><h3>{title(item.title)}</h3><p>見る理由：両時点の記載と、確認できた範囲を確かめる。</p><button id={`signal-observation-open-${item.id}`} className="signal-button" onClick={() => choose(item.id)}>保存した根拠を見る →</button></div></article>)}</div>
      {next.length === 0 ? <p>{result.comparable ? 'この比較に表示できる記事の取得記録はありません。保存候補の一覧を確認できます。' : result.reason === 'incomplete_snapshot' || result.reason === 'article_fetch_failed' ? '取得が完了していないため、変化の判定を保留しています。' : '条件または抽出版が異なるため、変化の判定を保留しています。'}</p> : null}
      <details className="signal-observation-coverage"><summary>取得範囲・保存候補を確認</summary><p>{before.scopeLabel}</p><p>{time(before.observedAt)} → {time(after.observedAt)} UTC</p><p>登録入口の有限な掲載範囲です。分野全体の新着や未発表を示しません。候補外は削除・販売終了を意味しません。</p><p>条件：{derivation ? '保存HTMLを新版条件で再抽出' : result.conditionsVerified === 'recorded' ? '取得時に記録' : '既存記録から事後照合'} / 抽出版：{after.extractionVersion}</p>
        {derivation ? <><p>後の取得時点：旧保存{derivation.after.originalSavedCount} / 対象{derivation.after.originalEligibleCount} → 新保存{after.candidates.length} / 対象{after.eligibleCount}。旧保存集合から一覧リンク{derivation.after.excludedNavigationCount}件を除外、記事候補{derivation.after.recoveredArticleCount}件を回復。</p><p>再処理日時 <time dateTime={derivation.processedAt}>{time(derivation.processedAt)}</time> UTC。上の取得日時は原本のままです。</p></> : null}
        {hiddenNavigation ? <p>旧保存{after.candidates.length}候補のうち、記事候補{visibleCandidates.length}件を表示しています。</p> : null}
        <ul>{visibleCandidates.map((item) => <li key={item.id}>{title(item.title)} <span>公開日：{item.publishedAt ?? '不明'}</span></li>)}</ul></details>
    </>}
  </section>;
}

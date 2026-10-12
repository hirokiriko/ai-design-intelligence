import { useEffect, useRef, useState } from 'react';
import type { ComparisonMedia, Run } from './contract';
import { loadEditorialComparison, type EditorialComparison } from './editorial-comparison';
import { SignalEditorialComparison } from './SignalEditorialComparison';
import { SignalResult } from './SignalResult';
import { SignalScopeSummary } from './SignalScopeSummary';
import { SignalDrawingComparison } from './SignalDrawingComparison';
import { SignalObservationPanel } from './SignalObservationPanel';
import { RecordFact } from './SignalContext';
import { knownFailedChecks } from './result-quality';
import type { RunReviewState } from './run-review';
import './signal-discovery.css';

type SavedRun = Exclude<Run, { schemaVersion: '1.0.0' }>;
type Choice = 'product' | 'gazette';
type Selection = Choice | `record-${number}`;
type ProductState = { status: 'loading' | 'error' } | { status: 'ready'; comparison: EditorialComparison };

/** Read-only navigation over existing DTOs. Counts are not record-content changes. */
export function SignalDiscovery({ run, reviewState, scopes = [], onScopeChange, busy = false }: { run: SavedRun; reviewState?: RunReviewState; scopes?: { id: string; label: string }[]; onScopeChange?: (id: string) => void; busy?: boolean }) {
  const company = run.input.context.entity.name;
  const [product, setProduct] = useState<ProductState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [field, setField] = useState<Choice | 'all'>('all');
  const [selected, setSelected] = useState<Selection | null>(null);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const focusTarget = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    const request = new AbortController();
    void Promise.resolve().then(async () => {
      if (!active || !company) return;
      try {
        const comparison = await loadEditorialComparison(company, fetch, request.signal);
        if (!request.signal.aborted) setProduct({ status: 'ready', comparison });
      } catch { if (!request.signal.aborted) setProduct({ status: 'error' }); }
    });
    return () => { active = false; request.abort(); };
  }, [company, attempt]);
  useEffect(() => {
    if (!focusTarget.current) return;
    const target = root.current?.querySelector<HTMLElement>(focusTarget.current);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: 'auto' });
    focusTarget.current = null;
  }, [selected, field]);
  const choose = (choice: Selection | null) => {
    setMaterialsOpen(true);
    focusTarget.current = choice ? '#signal-discovery-detail' : `#signal-discovery-open-${selected}`;
    setSelected(choice);
  };
  const filter = (next: Choice | 'all') => {
    if (selected) focusTarget.current = '#signal-discovery-list-title';
    setField(next); setSelected(null);
  };
  const signal = run.signal;
  const pair = 'comparisonPair' in run.input ? run.input.comparisonPair : null;
  const media = (pair ? signal?.media.filter((item) => pair.media.some((member) => member.id === item.id)) : signal?.media) ?? [];
  const gazetteField = [...new Set(signal?.recordFacts.map((fact) => fact.articleName).filter(Boolean) ?? [])].join(' / ') || run.input.context.category.label;
  const comparison = product.status === 'ready' ? product.comparison : null;
  const productField = comparison?.discovery?.productKind ?? '公式商品資料';
  const failed = knownFailedChecks(run, reviewState);
  const continuing = signal ? signal.counts.after - signal.counts.newlyObserved : -1;
  const flagged = signal?.recordFacts.filter((fact) => fact.selectionReason === 'newly_observed') ?? [];
  const newRecords = signal?.counts.comparable && signal.counts.newlyObserved > 0 && continuing >= 0 && continuing <= signal.counts.before && flagged.length <= signal.counts.newlyObserved ? flagged : [];
  const selectedRecord = newRecords.find((_, index) => selected === `record-${index}`);
  const gazetteTitle = !signal ? '保存結果の状態を確かめる' : !signal.counts.comparable ? '収録条件が異なり、対象の増減は比較できません' : signal.counts.newlyObserved ? `収録範囲で新しく観測された対象 ${signal.counts.newlyObserved}件` : '対象の追加は0件。収録範囲を確かめる';
  return <section className="signal-discovery" ref={root} aria-label="対象から見る資料を選ぶ">
    <div className="signal-discovery-scope">
      <div><span className="signal-eyebrow">対象企業</span><strong>{company ?? '企業名未記録'}</strong><span className="signal-subtle">{gazetteField}</span></div>
      <label className="signal-field">見る資料<select value={field} onChange={(event) => filter(event.target.value as Choice | 'all')}><option value="all">すべての保存資料</option><option value="gazette">{gazetteField} · 公報</option>{comparison ? <option value="product">{productField} · 商品資料</option> : null}</select></label>
      <a href="#signal-conditions" className="signal-text-button">対象・収録条件を確認</a>
    </div>
    {selected ? <>
      <button type="button" className="signal-text-button signal-discovery-back" onClick={() => choose(null)}>← 注目候補の一覧へ戻る</button>
      <div id="signal-discovery-detail" tabIndex={-1} className="signal-discovery-detail">
        {selected === 'product' && comparison ? <SignalEditorialComparison comparison={comparison} summaryOnly /> : selectedRecord ? <section className="signal-panel">
          <p className="signal-eyebrow">選んだ一件 · 公報の収録追加</p><h2>{selectedRecord.articleName ?? '物品名未記録'} · 登録 {selectedRecord.registrationNumber ?? '番号未記録'}</h2>
          <p>この企業・分類で、後の収録集合にだけ含まれる意匠です。監視時点の新着や新商品の発表を意味しません。</p>
          <RecordFact fact={selectedRecord} />
          {signal!.media.some((item) => item.recordId === selectedRecord.recordId) ? <div className="signal-discovery-drawings">{signal!.media.filter((item) => item.recordId === selectedRecord.recordId).map((item) => <DrawingThumbnail key={item.id} media={item} />)}</div> : <p className="signal-discovery-boundary">この一件の図面は保存結果にありません。形状や販売商品との対応は未確認です。</p>}
          <details className="signal-details"><summary>この一件を含む収録範囲・抽出条件</summary><SignalScopeSummary run={run} embedded /></details>
        </section> : <>
          <section className="signal-panel"><p className="signal-eyebrow">選んだ資料 · {gazetteField}</p><h2>{gazetteTitle}</h2>
            <p>見る理由：入力全体の増減と、この企業・分類で増えた対象を区別するため。</p>
            <SignalScopeSummary run={run} embedded />
            {media.length ? <><h3>この保存結果の根拠図面</h3><p className="signal-subtle">比較A/Bは資料の役割です。商品世代や発売順・仕様の変更を示しません。</p><div className="signal-discovery-drawings">{media.map((item) => <DrawingThumbnail key={item.id} media={item} />)}</div><SignalDrawingComparison media={media} /></> : <p className="signal-subtle">この結果に表示できる保存図面はありません。</p>}
            <p className="signal-discovery-boundary">商品資料との対応は未確認です。件数や図面の存在から、商品の変更は判断しません。</p>
          </section>
          <details className="signal-discovery-archive"><summary>この資料の保存分析・引用・未確認事項を開く</summary><SignalResult run={run} focusOnLoad={false} reviewState={reviewState} /></details>
        </>}
      </div>
      <button type="button" className="signal-text-button signal-discovery-back" onClick={() => choose(null)}>← 注目候補の一覧へ戻る</button>
    </> : <>
      {field === 'all' ? <SignalObservationPanel key={`${run.input.context.entity.id}:${run.input.context.category.id}`} entityId={run.input.context.entity.id} categoryId={run.input.context.category.id} /> : null}
      <details className="signal-discovery-other" open={materialsOpen || field !== 'all' || scopes.some((scope) => scope.id === run.watchId) && scopes[0]?.id !== run.watchId} onToggle={(event) => setMaterialsOpen(event.currentTarget.open)}>
      <summary>商品資料・公報の保存根拠を見る</summary>
      {scopes.length > 1 && onScopeChange && scopes.some((scope) => scope.id === run.watchId) ? <label className="signal-field signal-discovery-scope-picker">公報の分野・比較範囲<select value={run.watchId} disabled={busy} onChange={(event) => onScopeChange(event.target.value)}>{scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.label}</option>)}</select><small>条件を変えて保存結果を表示します。監視の新着としては扱いません。</small></label> : null}
      <div className="signal-discovery-list-heading"><div><p className="signal-eyebrow">保存資料から、今見る一件を選ぶ</p><h2 id="signal-discovery-list-title" tabIndex={-1}>何を確かめますか？</h2></div><span>見る理由と、確認できる範囲</span></div>
      <div className="signal-discovery-cards">
        {field !== 'product' ? newRecords.map((fact, index) => <article key={fact.id} className="signal-discovery-card signal-discovery-gazette">
          <div className="signal-discovery-card-meta"><span className="signal-discovery-tag">この分類の収録追加</span><span>{run.input.context.category.label}</span></div>
          <h3>{fact.articleName ?? '物品名未記録'}<br />登録 {fact.registrationNumber ?? '番号未記録'}</h3>
          <div className="signal-discovery-record-date"><span>公報日</span><strong>{fact.gazetteDate ?? '未記録'}</strong><span>比較範囲 {run.input.context.beforeDataset.dataAsOf} → {run.input.context.afterDataset.dataAsOf}</span></div>
          <p className="signal-discovery-reason"><strong>見る理由</strong>選んだ企業・分類の後の集合にだけ収録されています。物品・分類を確認し、調査対象に含めるかを検討できます。</p>
          <p className="signal-discovery-boundary">収録範囲の追加です。前回監視からの新着・商品進化は未確認です。</p>
          <div className="signal-discovery-card-footer"><span>{signal!.media.some((item) => item.recordId === fact.recordId) ? '保存図面あり' : '書誌事項のみ · 図面なし'}</span><button id={`signal-discovery-open-record-${index}`} className="signal-button signal-primary" type="button" onClick={() => choose(`record-${index}`)}>この意匠の根拠を見る →</button></div>
        </article>) : null}
        {field !== 'gazette' && company ? comparison ? <article className="signal-discovery-card signal-discovery-product">
          <div className="signal-discovery-card-meta"><span className="signal-discovery-tag">公式資料の製品差</span><span>{productField}</span></div>
          <h3>{comparison.title}</h3>
          <div className="signal-discovery-spec" aria-label="今回の資料にある製品仕様"><p>{comparison.differences[0].label}</p><div>{comparison.products.map((item, index) => <div key={item.label}><strong>{item.label}</strong><span>{comparison.differences[0].values[index]}</span></div>)}</div></div>
          <p className="signal-discovery-reason"><strong>見る理由</strong>{comparison.discovery?.selectionReason ?? comparison.whyItMatters}</p>
          <p className="signal-discovery-boundary">{comparison.version === 3 ? '同じ取得回の製品間比較。' : '保存された製品間比較。取得回の対応は未記録です。'}前回監視との差は未判定です。</p>
          <div className="signal-discovery-card-footer"><span>{comparison.sources.length}資料{comparison.verification ? ` · 原文引用${comparison.verification.quotes.length}件` : ' · 原文未照合'}</span><button id="signal-discovery-open-product" type="button" className="signal-button signal-primary" onClick={() => choose('product')}>仕様の違いと原文を見る →</button></div>
        </article> : <article className="signal-discovery-card signal-discovery-loading"><h3>公式商品資料</h3>{product.status === 'error' ? <><p role="status">保存商品資料を読み込めません。公報の保存資料は確認できます。</p><button type="button" className="signal-button" onClick={() => { setProduct({ status: 'loading' }); setAttempt((value) => value + 1); }}>商品資料を読み直す</button></> : <p role="status">保存商品資料を読み込んでいます。</p>}</article> : null}
        {field !== 'product' ? <article className="signal-discovery-card signal-discovery-gazette">
          <div className="signal-discovery-card-meta"><span className="signal-discovery-tag">公報の収録差</span><span>{gazetteField}</span></div>
          <h3>{gazetteTitle}</h3>
          <div className="signal-discovery-gazette-visual">{media[0] ? <DrawingThumbnail media={media[0]} /> : <div className="signal-discovery-no-image">保存図面なし</div>}{signal ? <div className="signal-discovery-count"><span>この企業・分類の対象</span><strong>{signal.counts.before} <span>→</span> {signal.counts.after}<small>件</small></strong><span>収録入力は {signal.counts.before + signal.counts.excludedBefore} → {signal.counts.after + signal.counts.excludedAfter}件</span></div> : <p>保存された根拠はありません。</p>}</div>
          <p className="signal-discovery-reason"><strong>見る理由</strong>入力全体と対象分野の増減を分け、図面で確認する対象を絞るため。</p>
          <p className="signal-discovery-boundary">収録集合の比較です。同一対象の仕様変更や、前回監視との差はこの集計から判定しません。</p>
          {failed.length ? <p className="signal-discovery-quality">保存AI分析は要再確認：{failed.join(' / ')} 未達</p> : <p className="signal-subtle">保存AI分析の評価は、選択後に確認できます。</p>}
          <div className="signal-discovery-card-footer"><span>{run.input.context.beforeDataset.dataAsOf} → {run.input.context.afterDataset.dataAsOf}</span><button id="signal-discovery-open-gazette" type="button" className="signal-button" onClick={() => choose('gazette')}>収録差と図面を見る →</button></div>
        </article> : null}
      </div>
      <p className="signal-discovery-footnote">一覧は保存資料の種類で整理しています。重要度の自動判定ではありません。深い商品比較・判断・報告は別アプリの Workbench で行います。</p>
      </details>
    </>}
  </section>;
}

function DrawingThumbnail({ media }: { media: ComparisonMedia }) {
  const [failed, setFailed] = useState(false);
  return <figure className="signal-discovery-thumbnail">{failed ? <p role="status">保存図面を表示できません</p> : <img src={`/api/v1/media/${encodeURIComponent(media.id)}`} width={media.width} height={media.height} alt={`${media.label}。${media.view ?? '方向不明'}`} onError={() => setFailed(true)} />}<figcaption>{media.role === 'comparisonA' ? '比較A' : '比較B'} · {media.view ?? '方向不明'}<small>{media.sourceLabel}</small></figcaption></figure>;
}

import { useEffect, useRef, useState } from 'react';
import type { Run, Signal, SignalV2 } from './contract';
import { comparisonCoverageSummary, comparisonStatusLabel, designFactFieldLabel, designFactText, evidenceId, factsOnlyRun, recordDisplayLabel, runStatusLabel } from './labels';
import { SignalRecordEvidence } from './SignalRecordEvidence';
import { DiscoveryDetails, EvidenceLinks, RecordFact, Relationships, ResultOverview, SavedContext, SavedTarget } from './SignalContext';

const statusLabels: Record<Signal['status'], string> = { change_detected: '収録範囲で変化を確認', no_change: '収録範囲で新しい変化なし', insufficient: '判断する資料が不足', comparison_unavailable: '収録条件が異なり比較できません' };
const observationLabels = { change_candidate: '変化の候補', no_change: '変化は見られない', unknown: '判断不能' };

function MediaCard({ media, run }: { media: Signal['media'][number]; run: Run }) {
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const path = `/api/v1/media/${encodeURIComponent(media.id)}`;
  const record = run.schemaVersion === '1.0.0' ? undefined : run.signal?.recordFacts.find((item) => item.recordId === media.recordId);
  return <figure id={evidenceId(media.id)} className="signal-media-card" tabIndex={-1}>
    <figcaption><strong>{media.role === 'comparisonA' ? '比較A' : '比較B'} · {media.label}</strong></figcaption>
    {failed ? <p role="status">画像の取得失敗：保存結果の画像を表示できません。認証または資料の配置を確認してください。画像の変化を判定した結果ではありません。</p> : <button className="signal-image-button" type="button" onClick={() => dialog.current?.showModal()} aria-label={`${media.label}を拡大`}>
      <img src={path} width={media.width} height={media.height} alt={`${media.label}。${media.view ?? '方向不明'}。${comparisonStatusLabel(media.comparisonStatus)}`} onError={() => setFailed(true)} />
      <span>画像を拡大</span>
    </button>}
    <dl className="signal-metadata"><div><dt>登録番号</dt><dd>{record?.registrationNumber ?? '不明'}</dd></div><div><dt>公報日</dt><dd>{media.gazetteDate ?? '不明'}</dd></div><div><dt>出願日</dt><dd>{media.applicationDate ?? '不明'}</dd></div><div><dt>方向・対応条件</dt><dd>{media.view ?? '方向不明'} / {comparisonStatusLabel(media.comparisonStatus)}</dd></div><div><dt>情報源・利用条件</dt><dd>{media.sourceLabel} / {media.permission}</dd></div></dl>
    <SignalRecordEvidence recordId={media.recordId} watch={run.input.watch} label={recordDisplayLabel(record, media.label)} />
    <dialog ref={dialog} className="signal-image-dialog" aria-label={`${media.label}の拡大画像`}>
      <form method="dialog"><button className="signal-button" autoFocus>閉じる</button></form>
      <p><strong>{media.role === 'comparisonA' ? '比較A' : '比較B'} · {media.label}</strong></p>
      <p className="signal-subtle">形状比較とAI観察候補の内容を確かめるための根拠資料です。比較A / Bは資料の役割であり、商品の新旧世代や発売順を示しません。</p>
      <dl className="signal-metadata"><div><dt>情報源・利用条件</dt><dd>{media.sourceLabel} / {media.permission}</dd></div><div><dt>物品名 / 登録番号</dt><dd>{record?.articleName ?? media.label} / {record?.registrationNumber ?? '不明'}</dd></div><div><dt>公報日 / 出願日</dt><dd>{media.gazetteDate ?? '不明'} / {media.applicationDate ?? '不明'}</dd></div><div><dt>方向・対応条件</dt><dd>{media.view ?? '方向不明'} / {comparisonStatusLabel(media.comparisonStatus)}</dd></div></dl>
      {!failed ? <img src={path} alt={media.label} /> : null}
    </dialog>
  </figure>;
}

function SourceCard({ source, run }: { source: Signal['sources'][number]; run: Run }) {
  const v2Source = 'extractionVersion' in source ? source as SignalV2['sources'][number] : null;
  const factsOnly = factsOnlyRun(run);
  const manualFact = factsOnly && v2Source?.extractionVersion === 'manual-public-fact-1.0.0';
  return <article id={evidenceId(source.id)} className="signal-source" tabIndex={-1}>
    <h4>{factsOnly ? source.title || 'タイトル不明' : <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || 'タイトル不明'} ↗</a>}</h4>
    <p className="signal-subtle">{run.schemaVersion !== '1.0.0' ? '発表日' : '公開日'}：{source.publishedAt ?? '不明'} · {manualFact ? '手動確認日時' : '取得日時'}：{source.retrievedAt}</p>
    {v2Source ? <p className="signal-subtle">更新日：{v2Source.updatedAt ?? '不明'} · 発売日：{v2Source.releaseAt ?? '不明'}</p> : null}
    {source.retrospective ? <p className="signal-retrospective">事後照合：意匠の基準日より後の資料を含みます。</p> : null}
    {manualFact ? <p className="signal-subtle">手動確認した参照先・URLです。記事本文・画像は保存せず、AIへ送信していません。</p> : v2Source ? <>
      <p className="signal-subtle">AIが確認した抜粋：先頭{v2Source.modelVisibleChars}文字 / 抽出対象{v2Source.extractedChars}文字。{v2Source.truncated ? '省略した範囲があります。全文確認ではありません。' : '抽出した範囲のみの確認です。ページ全体の確認とは限りません。'}</p>
      <blockquote>{Array.from(source.excerpt).slice(0, v2Source.modelVisibleChars).join('') || '抜粋なし'}</blockquote>
      {Array.from(source.excerpt).length > v2Source.modelVisibleChars ? <details><summary>保存された抜粋の残り（AIは未確認）</summary><blockquote>{Array.from(source.excerpt).slice(v2Source.modelVisibleChars).join('')}</blockquote></details> : null}
    </> : <blockquote>{source.excerpt || '抜粋なし'}</blockquote>}
    <p className="signal-subtle readable-text">{source.url}</p>
    <p className="signal-subtle">{factsOnly ? '公式URLは保存時の参照先を示す文字情報です。この画面から外部ページを開きません。' : '出典リンクは別タブで開きます。根拠の表示でAI・外部ページ取得を自動実行しません。'}</p>
  </article>;
}

export function SignalResult({ run }: { run: Run }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const result = useRef<HTMLElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [run.id, run.status]);
  useEffect(() => {
    const openedForPrint = new Set<HTMLDetailsElement>();
    const preparePrint = () => result.current?.querySelectorAll<HTMLDetailsElement>('details[data-print-evidence]').forEach((details) => {
      if (!details.open) { openedForPrint.add(details); details.open = true; }
    });
    const restoreDetails = () => { openedForPrint.forEach((details) => { details.open = false; }); openedForPrint.clear(); };
    window.addEventListener('beforeprint', preparePrint);
    window.addEventListener('afterprint', restoreDetails);
    return () => { window.removeEventListener('beforeprint', preparePrint); window.removeEventListener('afterprint', restoreDetails); restoreDetails(); };
  }, [run.id]);
  const signal = run.signal;
  const factsOnly = factsOnlyRun(run);
  const target = run.schemaVersion === '1.0.0' ? run.input.watch.name : `${run.input.context.entity.name ?? '企業名不明'} / ${run.input.context.category.label}`;
  return <article ref={result} className="signal-result" aria-labelledby="signal-result-heading">
    <div className="signal-result-title"><div><p className="signal-eyebrow">保存された確認結果</p><h2 ref={heading} tabIndex={-1} id="signal-result-heading">{target}</h2></div><span className={`signal-badge status-${run.status}`}>{runStatusLabel(run)}</span></div>
    <SavedTarget run={run} />
    {factsOnly ? <p className="signal-mode-note"><strong>書誌情報のみの比較・画像/記事分析は未実施</strong><br />実行時に記事本文・図面を取得せず、AI・Vertexへ送信していません。</p> : signal ? <p className="signal-mode-note"><strong>{statusLabels[signal.status]}</strong></p> : null}
    {run.versions.model === 'fixture-controller' || run.versions.model.startsWith('fictional-') ? <p className="signal-data-banner">模擬モデル（接続・保存の検証） · 実際の画像AI・公式サイト取得の評価結果ではありません。</p> : null}
    {(run.status === 'failed' || run.status === 'interrupted') ? <p role="alert" className="signal-error">{runStatusLabel(run)}。変化なしという結果ではありません。保存履歴は再取得でき、再実行は別の操作です。</p> : null}
    {run.status === 'partial' ? <p role="alert" className="signal-error">確認処理が途中で終了しました。確定したシグナルはありません。資料不足という通常の結果とは別の実行状態です。</p> : null}
    {run.status === 'running' ? <p role="status">バックエンドで確認中です。「履歴を再取得」で状態を読み直せます。表示のための再実行は行いません。</p> : null}
    {signal ? <>
      <ResultOverview run={run} />
      <div className="signal-counts"><div><span>比較Aの対象</span><strong>{signal.counts.before}<small>件</small></strong></div><div><span>比較Bの対象</span><strong>{signal.counts.after}<small>件</small></strong></div><div><span>収録範囲での新規観測</span><strong>{signal.counts.newlyObserved}<small>件</small></strong></div></div>
      <details className="signal-details signal-facts" id="signal-design-facts" data-print-evidence><summary>意匠データの事実と個別の根拠を確認</summary><p className="signal-subtle">{comparisonCoverageSummary(signal)}</p>{signal.designFacts.length ? signal.designFacts.map((fact, factIndex) => <div className="signal-fact" id={evidenceId(fact.id)} key={fact.id} tabIndex={-1}><p>{designFactText(fact.text, fact.field)}</p><p className="signal-subtle">項目：{designFactFieldLabel(fact.field)}</p>{run.schemaVersion !== '1.0.0' ? run.signal?.recordFacts.filter((item) => item.id === fact.id).map((item) => <RecordFact key={item.id} fact={item} />) : null}{fact.recordIds.map((recordId, recordIndex) => {
        const record = run.schemaVersion === '1.0.0' ? undefined : run.signal?.recordFacts.find((item) => item.recordId === recordId);
        const mediaLabel = signal.media.find((item) => item.recordId === recordId)?.label;
        return <SignalRecordEvidence key={recordId} recordId={recordId} watch={run.input.watch} label={recordDisplayLabel(record, mediaLabel ?? `事実${factIndex + 1}の候補${recordIndex + 1}（物品名未確認）`)} />;
      })}</div>) : <p>今回の範囲では、追加の事実を確認できませんでした。</p>}</details>
      {factsOnly ? <section id="signal-images"><h3>画像と観察</h3><p><strong>未実施</strong>：この結果には公報図面・製品画像を保存・表示していません。形状の変化は評価していません。</p></section> : <section id="signal-images"><h3>画像からのAI観察候補</h3><p className="signal-subtle">画像内の観察候補です。製品の仕様、販売予定、企業戦略を確定するものではありません。</p>
        <p className="signal-subtle">比較A / Bは資料の役割です。商品の旧世代 / 新世代や発売順を表しません。画像の出所と対応条件を各資料で確認してください。</p>
        {signal.media.length ? <div className="signal-media-grid">{signal.media.map((media) => <MediaCard key={media.id} media={media} run={run} />)}</div> : <div className="signal-empty">保存結果に画像はありません。図面の情報だけから画像を補っていません。</div>}
        {signal.visualObservations.length ? signal.visualObservations.map((item) => <div className="signal-fact signal-observation" id={evidenceId(item.id)} key={item.id} tabIndex={-1}><p><strong>{item.part}</strong> · {observationLabels[item.status]}</p><p>{item.observation}</p><EvidenceLinks ids={item.mediaIds} signal={signal} /></div>) : <p>画像観察の結果は未記録です。保存情報だけでは、未実施・取得失敗・判断不能を特定できません。変化なしとは扱いません。</p>}
      </section>}
      <section id="signal-official"><h3>公式発表の事実</h3>{!factsOnly && signal.officialFacts.length ? <p className="signal-subtle">企業が公表した内容です。個別意匠との対応の確かさは、後の検討材料で分けて示します。</p> : null}{signal.officialFacts.length ? signal.officialFacts.map((fact) => {
        const source = signal.sources.find((item) => item.id === fact.sourceId);
        const publishedBeforeComparison = run.schemaVersion !== '1.0.0' && source?.publishedAt != null
          && source.publishedAt.slice(0, 10) < run.input.context.beforeDataset.dataAsOf;
        return <div className="signal-fact" id={evidenceId(fact.id)} key={fact.id} tabIndex={-1}>
          <p>{fact.text}</p>
          <p className="signal-subtle">出典：{source?.title || 'タイトル不明'} · {run.schemaVersion === '1.0.0' ? '公開日' : '発表日'}：{source?.publishedAt ?? '不明'}</p>
          {publishedBeforeComparison ? <p className="signal-subtle">比較Aの基準日より前の発表です。</p> : null}
          <blockquote>{fact.quote}</blockquote><EvidenceLinks ids={[fact.sourceId]} signal={signal} />
        </div>;
      }) : <p>{factsOnly ? '未実施：公式記事の本文は保存・分析していないため、発表内容を結果の根拠に採用していません。' : '今回の結果に採用された公式発表はありません。取得や分析の個別状態は、保存情報だけでは特定できません。'}</p>}
      {signal.sources.length ? <><h4>{factsOnly ? '手動確認した参照先・URL' : '確認した公式資料'}</h4>{signal.sources.map((source) => <SourceCard key={source.id} source={source} run={run} />)}</> : null}</section>
      <section className="signal-hypotheses"><h3>検討材料と未確認事項</h3><h4>関連仮説 · 未確認</h4><p className="signal-subtle">{factsOnly ? '記事本文と図面を分析していないため、意匠と商品の関係は評価していません。' : run.schemaVersion !== '1.0.0' ? '関連性についての仮説とその限界です。個別製品との対応の確認状況は「個別意匠と商品の対応」で確認してください。' : '意匠と公式資料の関係は仮説です。公式に同一製品や商品化を確認したことを意味しません。'}</p>{signal.hypotheses.length ? signal.hypotheses.map((item) => <div className="signal-fact" key={item.id} id={evidenceId(item.id)} tabIndex={-1}><p>{item.text}</p><EvidenceLinks ids={item.evidenceIds} signal={signal} /><ul>{item.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></div>) : <p>{factsOnly ? '関連仮説の分析は未実施です。' : '根拠のある関連仮説はありません。'}</p>}
      {run.schemaVersion !== '1.0.0' && run.signal ? <Relationships signal={run.signal} factsOnly={factsOnly} /> : null}
      <div id="signal-next-checks" className="signal-next-checks"><h4>未確認事項・次に確認する資料</h4>{signal.questionsForHuman.length ? <ul>{signal.questionsForHuman.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>追加の確認事項は登録されていません。</p>}</div>
      <h4>不明点・資料の限界</h4>{signal.limitations.length ? <ul>{signal.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>追加の不明点は登録されていません。収録範囲外は評価していません。</p>}</section>
    </> : null}
    <details className="signal-details" data-print-evidence><summary>収録条件と保存対象の詳細</summary><SavedContext run={run} /></details>
    {run.schemaVersion !== '1.0.0' ? <DiscoveryDetails run={run} /> : null}
    {signal ? <details className="signal-details"><summary>短い実行履歴と終了理由</summary><p>保存された総合判定：{statusLabels[signal.status]}</p><ol>{signal.toolEvents.map((event, index) => <li key={index}><strong>{event.tool === 'finish' ? '終了 / 不足' : event.tool === 'list_candidates' ? '公式候補確認' : '追加確認'}</strong> · {event.outcome}<p>{event.reason}</p><p className="signal-subtle">{event.startedAt} → {event.finishedAt}</p></li>)}</ol><p><strong>終了 / 不足</strong>：{signal.stopReason}</p></details> : null}
    <details className="signal-details" data-print-evidence><summary>保存条件・実行情報</summary><dl className="signal-metadata"><div><dt>実行日時</dt><dd>{run.createdAt}</dd></div><div><dt>終了日時</dt><dd>{run.completedAt ?? '未完了'}</dd></div><div><dt>企業 / 分類</dt><dd>{run.schemaVersion === '1.0.0' ? '旧版には表示名未記録' : target}</dd></div><div><dt>比較A / 比較Bの基準日</dt><dd>{run.schemaVersion === '1.0.0' ? '旧版には基準日未記録' : `${run.input.context.beforeDataset.dataAsOf} / ${run.input.context.afterDataset.dataAsOf}`}</dd></div><div><dt>AIモデル</dt><dd>{run.versions.model}</dd></div><div><dt>AI呼出 / 確認処理</dt><dd>{run.usage.modelRequests} / {run.usage.toolCalls}</dd></div></dl>{run.status === 'complete' ? <p className="signal-subtle">処理終了は、同一製品・商品化やすべての根拠の確認が済んだことを意味しません。</p> : null}<p className="signal-subtle">保存履歴の再表示・再読み込みではAIを呼び出しません。過去の結果は上書きしません。</p></details>
  </article>;
}

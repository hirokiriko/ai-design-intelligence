import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import type { ComparisonMedia, Run, SignalV2 } from './contract';
import { knownFailedChecks } from './result-quality';
import { reviewMatchesRun, type RunReviewState } from './run-review';
import { runStatusLabel } from './labels';
import { savedStopExplanation } from './execution-explanation';
import { SignalDrawingComparison } from './SignalDrawingComparison';
import { SignalResult } from './SignalResult';
import { SignalScopeSummary } from './SignalScopeSummary';
import { explanationDisplayText, sourceDisplayTitle, sourceReferenceText } from './source-display';
import { investigationsForSelection, savedObservationExcerpt } from './focus-display';
import { confirmationGuide } from './confirmation-guide';
import { SignalConfirmationGuide } from './SignalConfirmationGuide';
import { SignalReferenceQuotes } from './SignalReferenceQuotes';
import { SignalObservationReason, SignalObservationAssessment, SignalObservationNextPlan } from './SignalObservationPlan';
import './signal-focus-journey.css';

type SavedRun = Exclude<Run, { schemaVersion: '1.0.0' }>;
type Observation = SignalV2['visualObservations'][number];
type Step = 'drawing' | 'source' | 'next';
const steps: { id: Step; label: string }[] = [
  { id: 'drawing', label: '図面で確かめる' },
  { id: 'source', label: '公式記載と照らす' },
  { id: 'next', label: '次の調査を決める' },
];
const statusText: Record<Observation['status'], string> = {
  change_candidate: '描画の違いを確かめる', no_change: '共通とされた箇所を確かめる', unknown: '判断できない箇所を確かめる',
};
const candidateStatusText: Record<Observation['status'], string> = {
  change_candidate: '描画の違い候補', no_change: '共通箇所の候補', unknown: '比較未確認',
};

function shortSavedText(text: string, maximum = 36) {
  const characters = Array.from(text);
  return characters.slice(0, maximum).join('') + (characters.length > maximum ? '…' : '');
}

function Drawing({ media, compact = false }: { media: ComparisonMedia; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return <figure className={`signal-focus-drawing${compact ? ' is-compact' : ''}`}>
    {!compact ? <figcaption><strong>{media.role === 'comparisonA' ? '比較A' : '比較B'}</strong><span>{media.view ?? '方向不明'}</span></figcaption> : null}
    {failed ? <p role="status">図面を表示できません。画像を確認できるまで、形状は判断できません。</p> : <>
      {!loaded && !compact ? <p className="signal-focus-image-loading" role="status">図面を読み込み中…</p> : null}
      <img src={`/api/v1/media/${encodeURIComponent(media.id)}`} width={media.width} height={media.height} alt={`${media.label}。${media.view ?? '方向不明'}`} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
    </>}
    {!compact ? <p>{media.label}<small>公報日 {media.gazetteDate ?? '不明'}</small></p> : null}
  </figure>;
}

/** Uses the selected immutable run and existing authenticated media routes only. */
export function SignalFocusJourney({ run, reviewState, scopes, onScopeChange, busy = false }: {
  run: SavedRun; reviewState?: RunReviewState; scopes: { id: string; label: string }[];
  onScopeChange: (id: string) => void; busy?: boolean;
}) {
  const signal = run.signal;
  const observations = signal?.visualObservations ?? [];
  const [selection, setSelection] = useState<string | null>(() => {
    const saved = typeof window === 'undefined' ? null : new URL(window.location.href).searchParams.get('focus');
    return observations.some((item) => item.id === saved) ? saved : null;
  });
  const [step, setStep] = useState<Step>('drawing');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const detail = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<'detail' | string | null>(null);
  const id = useId();
  const selected = observations.find((item) => item.id === selection) ?? observations[0];
  const selectedScope = scopes.find((scope) => scope.id === run.watchId);
  const failed = knownFailedChecks(run, reviewState);
  const visualHeld = failed.includes('V2');
  const matchedReview = reviewState?.status === 'ready' && reviewState.review && reviewMatchesRun(reviewState.review, run) ? reviewState.review : null;
  const nextHeld = failed.includes('V4');
  const media = signal?.media.filter((item) => selected?.mediaIds.includes(item.id)) ?? [];
  const guide = selected && signal ? confirmationGuide(selected, signal.media) : null;
  const records = signal?.recordFacts.filter((fact) => media.some((item) => item.recordId === fact.recordId)) ?? [];
  const article = [...new Set(records.map((record) => record.articleName).filter(Boolean))].join(' / ') || run.input.context.category.label;
  const relationships = signal?.relationships.filter((item) => selected && [...item.supportingEvidenceIds, ...item.opposingEvidenceIds].includes(selected.id)) ?? [];
  const relatedEvidence = new Set(relationships.flatMap((item) => [...item.supportingEvidenceIds, ...item.opposingEvidenceIds]));
  const facts = signal?.officialFacts.filter((fact) => relatedEvidence.has(fact.id)) ?? [];
  const typedPlans = run.schemaVersion === '2.6.0' ? run.signal?.questionAnswer.observationPlans ?? [] : [];
  const selectedPlan = typedPlans.find(plan => plan.observationId === selected?.id);
  const selectedExcerpt = savedObservationExcerpt(selected?.observation ?? '');
  const qualitySummary = failed.length ? '品質未達・採用保留' : reviewState?.status === 'loading' ? '内容の評価を確認中' : matchedReview?.ownerAcceptance === 'ACCEPTED' ? '受入記録あり・根拠と限界を要確認' : matchedReview?.ownerAcceptance === 'REJECTED' ? '利用者の受入は見送り' : matchedReview ? '利用者による受入は未完了' : '内容の評価は未確認';
  const correspondenceSummary = selectedPlan
    ? { supports: '公式記載との対応候補（AI評価）', conflicts: '公式記載と食い違う可能性（AI評価）', unverified: '公式資料との対応は未確認' }[selectedPlan.officialAssessment.stance]
    : relationships.length ? '公式資料との保存された対応評価あり' : '公式資料との対応は未確認';
  const nextChecks = (run.schemaVersion === '2.5.0' || run.schemaVersion === '2.6.0') ? run.signal?.questionAnswer.nextChecks ?? [] : signal?.questionsForHuman ?? [];
  // Version 2.6 scopes only through typed observationId; global prose is never parsed.
  const investigations = run.schemaVersion === '2.6.0' ? { selected: [], other: [] } : investigationsForSelection(nextChecks, observations, selected?.id ?? '');
  const selectedMissing = relationships.flatMap((item) => item.missingEvidence);
  const otherMissing = signal?.relationships.filter((item) => !relationships.includes(item)).flatMap((item) => item.missingEvidence) ?? [];
  useEffect(() => {
    if (!pendingFocus.current) return;
    const target = pendingFocus.current === 'detail' ? detail.current : document.getElementById(pendingFocus.current);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: pendingFocus.current === 'detail' ? 'start' : 'nearest', behavior: 'auto' });
    pendingFocus.current = null;
  }, [selection, step]);
  useEffect(() => {
    const openedForPrint = new Set<HTMLDetailsElement>();
    const preparePrint = () => detail.current?.querySelectorAll<HTMLDetailsElement>('details[data-print-evidence]').forEach((item) => {
      if (!item.open) { openedForPrint.add(item); item.open = true; }
    });
    const restorePrint = () => { openedForPrint.forEach((item) => { item.open = false; }); openedForPrint.clear(); };
    window.addEventListener('beforeprint', preparePrint);
    window.addEventListener('afterprint', restorePrint);
    return () => { window.removeEventListener('beforeprint', preparePrint); window.removeEventListener('afterprint', restorePrint); restorePrint(); };
  }, [run.id]);
  const choose = (observation: Observation | null) => {
    pendingFocus.current = observation ? 'detail' : `${id}-candidate-${selection}`;
    const url = new URL(window.location.href);
    if (observation) url.searchParams.set('focus', observation.id); else url.searchParams.delete('focus');
    window.history.replaceState(null, '', url);
    setSelection(observation?.id ?? null); setStep('drawing');
  };
  const changeStep = (next: Step) => { pendingFocus.current = 'detail'; setStep(next); };
  const chooseReference = (event: MouseEvent<HTMLButtonElement>) => {
    const observation = observations.find((candidate) => candidate.id === event.currentTarget.dataset.observationId);
    if (observation) choose(observation);
  };
  const [selectedInvestigationList, otherInvestigationList] = [investigations.selected, investigations.other].map((items, group) => <ol key={group} className={`signal-focus-investigations ${group === 0 ? 'signal-focus-next-list' : 'signal-focus-run-next-list'}`}>
    {items.map((item) => <li key={item.index}><span className="signal-focus-investigation-label">調査候補 {item.index + 1}</span>
      <p>{item.segments.map((segment, index) => segment.kind === 'text' ? explanationDisplayText(sourceReferenceText(segment.text, signal?.sources ?? [])) : <button key={index} className="signal-focus-observation-reference" data-observation-id={segment.id} type="button" onClick={chooseReference}>{segment.label}</button>)}</p>
      <details className="signal-focus-original-text"><summary>保存された調査文を確認する</summary><p>{item.text}</p></details>
    </li>)}
  </ol>);
  return <section className="signal-focus-journey" aria-label="注目候補から根拠と次の調査へ">
    <div className="signal-focus-scope">
      <div className="signal-focus-scope-title"><span className="signal-eyebrow">対象企業・分野</span><h1>{run.input.context.entity.name ?? '企業名未記録'}<span>{article}</span></h1></div>
      <div className="signal-focus-context"><span>{run.input.context.dataMode === 'fictional' ? '架空資料の保存例' : '過去の保存実例'}</span><span>公報の比較範囲 {run.input.context.beforeDataset.dataAsOf} → {run.input.context.afterDataset.dataAsOf}</span>{signal ? <span className="signal-focus-saved-counts">保存集合の対象 {signal.counts.before} → {signal.counts.after}件 / {signal.counts.comparable ? `新たに対象となった資料 ${signal.counts.newlyObserved}件` : '新規対象数は比較不可'}</span> : null}<span>前回監視からの新着ではありません</span></div>
      <label className="signal-field">保存された対象範囲<select aria-label="対象企業・分野の保存条件" aria-describedby={`${id}-scope-value`} value={selectedScope?.id ?? ''} disabled={busy} onChange={(event) => onScopeChange(event.target.value)}>{!selectedScope ? <option value="">現在の登録範囲外の保存結果</option> : null}{scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.label}</option>)}</select><span id={`${id}-scope-value`} className="signal-subtle">選択中：{selectedScope?.label ?? '現在の登録範囲外の保存結果'}</span></label>
    </div>
    {run.status !== 'complete' ? <p className="signal-focus-caution" role="status"><strong>{runStatusLabel(run)} · 保存された途中資料です。</strong> {savedStopExplanation(run) ?? '実行は完了していません。観察や引用が揃った結果とは扱いません。'}</p> : null}
    {!signal || !observations.length ? <div className="signal-panel"><h2>この保存結果に、図面の注目候補はありません</h2><p>変化がないと判断した意味ではありません。収録資料と実行状態を確認できます。</p><SignalResult run={run} focusOnLoad={false} reviewState={reviewState} /></div> : <div className="signal-focus-layout" data-open={selection !== null}>
      <aside className="signal-focus-list" aria-label="図面の注目候補">
        <div className="signal-focus-list-heading"><h2 id="signal-focus-candidates-title" tabIndex={-1}>まず、どこを見る？</h2><span>保存された観察 {observations.length}件</span></div>
        {visualHeld ? <p className="signal-focus-caution">この実例のAI観察には誤りがあり、採用を保留しています。</p> : <p className="signal-subtle">AI観察候補・重要度順ではありません。</p>}
        {failed.includes('V1') && typedPlans.length ? <p className="signal-focus-caution">注目理由は品質未達のため採用保留です。保存文の抜粋を表示しています。</p> : null}
        {observations.map((item, index) => { const excerpt = savedObservationExcerpt(item.observation), itemPlan = typedPlans.find(plan => plan.observationId === item.id); return <button key={item.id} id={`${id}-candidate-${item.id}`} className="signal-focus-candidate" type="button" aria-pressed={selection === item.id} data-preview={selection === null && selected?.id === item.id ? true : undefined} onClick={() => choose(item)}>
          <span className="signal-focus-candidate-top"><span>着目点 {index + 1}</span><span>{visualHeld ? '原図で再確認' : itemPlan && failed.includes('V1') ? '注目理由は採用保留' : candidateStatusText[item.status]}</span></span>
          <span className="signal-focus-candidate-body">{signal.media.find((image) => item.mediaIds.includes(image.id)) ? <Drawing media={signal.media.find((image) => item.mediaIds.includes(image.id))!} compact /> : <span className="signal-focus-no-image">図面なし</span>}<span><strong>{item.part}</strong><span className="sr-only">{statusText[item.status]}</span>
            <span className="signal-focus-candidate-summary" data-ai-reason={itemPlan ? item.id : undefined}><span className="sr-only">{itemPlan ? '保存AIの注目理由の抜粋：' : '保存AI観察の抜粋：'}</span>{itemPlan ? shortSavedText(itemPlan.reason) : excerpt.kind === 'pair' ? <>A：{shortSavedText(excerpt.a.text, 34)} / B：{shortSavedText(excerpt.b.text, 34)}</> : shortSavedText(excerpt.excerpt.text || '観察本文は未記録です。')}</span>
          </span></span>
          <span className="sr-only">この箇所と根拠を見る</span>
        </button>; })}
        <details className="signal-details"><summary>収録範囲・件数を確認する</summary><SignalScopeSummary run={run} embedded /></details>
      </aside>
      {selected ? <div ref={detail} id="signal-focus-detail" tabIndex={-1} className="signal-focus-detail" aria-label="選んだ注目候補の根拠">
        {selection ? <button type="button" className="signal-text-button signal-focus-back" onClick={() => choose(null)}>← 注目候補の一覧へ戻る</button> : null}
        <div className="signal-focus-detail-meta"><header className="signal-focus-detail-heading"><span className="signal-eyebrow">{selection ? '選んだ着目点' : '先頭の着目点をプレビュー'} · <span>着目点 {observations.indexOf(selected) + 1}</span></span><h2>{selected.part}</h2><p>{article} · {statusText[selected.status]}</p></header>
          <div className="signal-focus-quality-status" data-held={failed.length > 0}><strong>{qualitySummary}</strong><span>{correspondenceSummary}</span><details className="signal-focus-quality-details" data-print-evidence><summary>内容の評価と利用上の注意</summary><p>{failed.length ? `この保存結果の品質未達：${failed.join(' / ')}。未達の記述は採用保留です。` : reviewState?.status === 'loading' ? 'この保存結果の品質評価を確認しています。' : matchedReview ? matchedReview.ownerAcceptance === 'ACCEPTED' ? 'このrunに紐づく受入記録があります。各根拠と限界を確認してください。' : matchedReview.ownerAcceptance === 'REJECTED' ? 'この保存結果は利用者の受入が見送られています。各根拠と限界を再確認してください。' : 'このrunの評価記録はありますが、OWNER受入は未完了です。' : 'このrunに紐づく品質評価は未登録または取得できません。表示できることは内容の合格を意味しません。'}</p></details></div>
        </div>
        <nav className="signal-focus-steps" aria-label="選んだ候補の確認手順">{steps.map((item, index) => <button key={item.id} type="button" aria-current={step === item.id ? 'step' : undefined} onClick={() => { if (!selection) choose(selected); changeStep(item.id); }}><span>{index + 1}</span>{item.label}</button>)}</nav>
        {step === 'drawing' ? <section className="signal-focus-step" aria-labelledby={`${id}-drawing-title`}>
          <div className="signal-focus-drawings">{media.map((item) => <Drawing key={item.id} media={item} />)}</div>
          {!media.length ? <p className="signal-focus-caution">対応する保存図面がありません。観察文だけで形状を確定できません。</p> : <div className="signal-focus-workbench-action"><SignalDrawingComparison compactControls media={media} focusPoints={[{ id: selected.id, text: visualHeld ? `【品質未達・採用保留の保存AI記述】${selected.observation}` : selected.observation, mediaIds: selected.mediaIds, displayNumber: observations.indexOf(selected) + 1 }]} onContinueToSources={() => changeStep('source')} /></div>}
          <h3 id={`${id}-drawing-title`}>この箇所を、原図で見比べる</h3>
          <div className="signal-focus-observation-summary" data-held={visualHeld}><strong>{visualHeld ? '再確認が必要な保存AI記述の抜粋' : '保存観察の抜粋'}</strong>{selectedExcerpt.kind === 'pair' ? <div className="signal-focus-excerpt-pair"><span><i>A</i><span>{selectedExcerpt.a.text}{selectedExcerpt.a.truncated ? '…' : ''}</span></span><span><i>B</i><span>{selectedExcerpt.b.text}{selectedExcerpt.b.truncated ? '…' : ''}</span></span></div> : <p>{selectedExcerpt.excerpt.text || '観察本文は未記録です。'}{selectedExcerpt.excerpt.truncated ? '…' : ''}</p>}</div>
          {run.schemaVersion === '2.6.0' && !selectedPlan ? <p>この箇所のAI理由は未評価です。固定ガイドで補っていません。</p> : null}
          <details key={selected.id} className="signal-focus-observation-details" data-print-evidence><summary>観察全文・注目理由・比較条件を確認する</summary>
            {selectedPlan ? <SignalObservationReason plan={selectedPlan} held={failed.includes('V1')} /> : null}
            {guide ? <p className="signal-focus-check-question"><strong>確認したい問い（固定ガイド）：</strong>{guide.question}</p> : null}
            <div className={`signal-focus-observation${visualHeld ? ' is-held' : ''}`}><h4>{visualHeld ? '再確認が必要な保存AI記述' : '保存されたAI観察候補'}</h4>{visualHeld ? <p className="signal-focus-caution">このrunの図面観察は品質未達です。以下を確認済みの事実として採用しないでください。</p> : null}<p>{selected.observation}</p></div>
          </details>
          <p className="signal-subtle">比較A/Bは資料の役割です。商品の発売順・世代や共通の縮尺を示しません。</p><button className="signal-button signal-primary" type="button" onClick={() => changeStep('source')}>公式記載と関係を確かめる →</button>
        </section> : step === 'source' ? <section className="signal-focus-step" aria-labelledby={`${id}-source-title`}><h3 id={`${id}-source-title`}>この図面を、公式記載は裏付ける？</h3>
          {run.schemaVersion === '2.6.0' ? selectedPlan ? <SignalObservationAssessment run={run} plan={selectedPlan} held={failed.includes('V3')} /> : <p>この箇所のAI引用評価は未評価です。</p> : <>
          {relationships.length ? relationships.map((relation) => <div key={relation.id} className="signal-focus-relation"><strong>{({ direct: '直接の対応として保存', category: '同じ分野として保存', candidate: '関連候補として保存', unrelated_or_conflicting: '関連しない・食い違う可能性', unknown: '対応は未確認' })[relation.relation]}</strong><p>{explanationDisplayText(relation.summary)}</p>{failed.some((item) => ['V2', 'V3', 'V4'].includes(item)) ? <p className="signal-focus-caution">未達の観察・引用・示唆を含むため、対応評価も再確認が必要です。</p> : null}{relation.missingEvidence.map((text, index) => <p key={index} className="signal-subtle">不足：{explanationDisplayText(text)}</p>)}</div>) : <p className="signal-focus-caution">この着目点を裏付ける公式引用と対応評価は保存されていません。商品と個別意匠の対応は未確認です。</p>}
          {facts.map((fact) => { const source = signal.sources.find((item) => item.id === fact.sourceId); return <article key={fact.id} className="signal-focus-source"><p className="signal-eyebrow">{relationships.some((item) => item.supportingEvidenceIds.includes(fact.id)) && relationships.some((item) => item.opposingEvidenceIds.includes(fact.id)) ? '支持・反証の両方で参照された引用' : relationships.some((item) => item.opposingEvidenceIds.includes(fact.id)) ? '反証・食い違いの根拠として保存' : '支持する根拠として保存'}</p><h4>{fact.text}</h4><blockquote>{fact.quote}</blockquote><p>{sourceDisplayTitle(source?.title ?? '')}</p><p className="signal-subtle">発表日 {source?.publishedAt ?? '不明'} · 取得 {source?.retrievedAt ?? '未記録'}</p>{source ? <a href={source.url} target="_blank" rel="noopener noreferrer">公式の出典を開く ↗</a> : null}</article>; })}
          </>}
          <SignalReferenceQuotes signal={signal} context={run.input.context} media={media} guide={guide} held={failed.includes('V3')} />
          <h4>同じ実行で取得した参考資料</h4><p className="signal-subtle">以下は保存された原文抜粋です。この着目点への裏付け引用とは区別しています。</p>
          {signal.sources.length ? signal.sources.map((source) => <article key={source.id} className="signal-focus-source"><h4>{sourceDisplayTitle(source.title)}</h4><p className="signal-subtle">発表日 {source.publishedAt ?? '不明'} · 取得 {source.retrievedAt}</p><blockquote>{Array.from(source.excerpt).slice(0, source.modelVisibleChars).join('') || '抜粋なし'}</blockquote>{source.truncated ? <p className="signal-subtle">保存された分析用抜粋には省略があります。</p> : null}<a href={source.url} target="_blank" rel="noopener noreferrer">公式の出典を開く ↗</a></article>) : <p>この実行に公式資料は保存されていません。</p>}
          <button className="signal-button signal-primary" type="button" onClick={() => changeStep('next')}>不足から、次の調査を選ぶ →</button>
        </section> : <section className="signal-focus-step" aria-labelledby={`${id}-next-title`}><h3 id={`${id}-next-title`}>判断を進めるために、何を調べる？</h3><p>固定の確認手順と、保存されたAIの調査事項を分けて示します。</p>
          {run.schemaVersion !== '2.6.0' && guide ? <SignalConfirmationGuide guide={guide} onDrawing={() => changeStep('drawing')} onSources={() => changeStep('source')} /> : null}
          {run.schemaVersion === '2.6.0' ? <>
            {selectedPlan ? <SignalObservationNextPlan plan={selectedPlan} held={nextHeld} /> : <p className="signal-focus-caution">この箇所のAI調査計画は未評価です。途中の観察から計画を補っていません。</p>}
            {nextChecks.length ? <details className="signal-focus-global-plans"><summary>実行全体の保存AI調査事項（{nextChecks.length}件）</summary><p>選択箇所との対応は指定されていません。</p><ol>{nextChecks.map((text, index) => <li key={index}>{text}</li>)}</ol></details> : null}
          </> : <>
          <h4>保存されたAIの調査事項</h4><p className="signal-subtle">以下は、この着目点のIDを明示した保存文です。固定ガイドによって保存AIの品質評価が変わることはありません。</p>
          {nextHeld ? <p className="signal-focus-caution">次の調査・示唆も品質未達です。保存された提案を示していますが、有用性の確認は完了していません。</p> : null}
          {investigations.selected.length ? selectedInvestigationList : <p className="signal-focus-caution">{nextChecks.length ? 'この着目点を明示する調査事項は保存されていません。実行全体の情報から確認できます。' : '具体的な次の調査は保存されていません。未記録を、追加調査が不要という結果には置き換えません。'}</p>}
          {selectedMissing.length ? <div className="signal-focus-next-why"><h4>この着目点の判断に不足していること</h4>{selectedMissing.map((text, index) => <p key={index}>{explanationDisplayText(text)}</p>)}</div> : null}
          {investigations.other.length || otherMissing.length ? <details key={selected.id} className="signal-focus-run-investigations"><summary>この実行全体の調査・不足を確認する{investigations.other.length ? `（ほかの調査 ${investigations.other.length}件）` : ''}</summary>
            <p className="signal-subtle">ほかの着目点を挙げた調査や、対象の参照がない調査を保持しています。選択中の箇所への指示とは限りません。</p>
            {investigations.other.length ? otherInvestigationList : null}
            {otherMissing.length ? <div className="signal-focus-next-why"><h4>実行全体で未確認のこと</h4>{otherMissing.map((text, index) => <p key={index}>{explanationDisplayText(text)}</p>)}</div> : null}
          </details> : null}
          </>}
          {run.schemaVersion === '2.6.0' && guide ? <SignalConfirmationGuide guide={guide} onDrawing={() => changeStep('drawing')} onSources={() => changeStep('source')} /> : null}
          <button className="signal-button" type="button" onClick={() => changeStep('drawing')}>図面に戻って調査対象を確かめる</button>
        </section>}
        <details className="signal-focus-archive" open={archiveOpen} onToggle={(event) => setArchiveOpen(event.currentTarget.open)}><summary>この実例の保存分析・根拠・履歴情報をすべて見る</summary>{archiveOpen ? <SignalResult run={run} focusOnLoad={false} reviewState={reviewState} /> : null}</details>
      </div> : null}
    </div>}
    <p className="signal-focus-saved">保存結果の閲覧です。選択・再表示でAIは実行しません。<a href="#signal-history">別の保存結果を開く</a></p>
  </section>;
}

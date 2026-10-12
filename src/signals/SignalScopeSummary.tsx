import { useContext, useEffect, useRef } from 'react';
import type { Run, RunV23, SignalV2 } from './contract';
import { classificationSchemeLabel, evidenceId } from './labels';
import { RecordFact, SavedContext } from './SignalContext';
import { RecordSelectionContext } from './record-selection';
import { SignalEditorialEntry } from './SignalEditorialEntry';

export function SignalScopeSummary({ run, embedded = false }: { run: Exclude<Run, { schemaVersion: '1.0.0' }>; embedded?: boolean }) {
  const signal = run.signal;
  if (!signal) return null;
  const { context } = run.input;
  const articles = [...new Set(signal.recordFacts.map((fact) => fact.articleName ?? '物品名不明'))];
  const continuing = signal.counts.after - signal.counts.newlyObserved;
  const canDerive = signal.counts.comparable && continuing >= 0 && continuing <= signal.counts.before;
  const beforeTotal = signal.counts.before + signal.counts.excludedBefore;
  const afterTotal = signal.counts.after + signal.counts.excludedAfter;
  const barScale = Math.max(1, beforeTotal, afterTotal);
  const rows = [
    { label: '比較Aの収録', date: context.beforeDataset.dataAsOf, count: signal.counts.before, excluded: signal.counts.excludedBefore, total: beforeTotal },
    { label: '比較Bの収録', date: context.afterDataset.dataAsOf, count: signal.counts.after, excluded: signal.counts.excludedAfter, total: afterTotal },
  ];
  return <div className="signal-scope-summary" aria-label="企業・分類の収録範囲の比較">
    <>{embedded ? null : <h1 id="signal-approved-scope-title">{context.entity.name ?? '企業名不明'}</h1>}</>
    <p className="signal-scope-category">{articles.join(' / ') || '物品名未収録'} <span>対象分類：{context.category.label} · {classificationSchemeLabel(context.category.scheme)}</span></p>
    <div className="signal-discovery-delta">
      <div className="signal-delta-headline"><span>収録内の新規観測</span><strong>{signal.counts.comparable ? <>{signal.counts.newlyObserved}<small>件</small></> : <small>比較不可</small>}</strong><p>対象意匠 <b>{signal.counts.before}</b> → <b>{signal.counts.after}</b>件</p><p className="signal-subtle">両集合に収録（算出）：{canDerive ? continuing + '件' : signal.counts.comparable ? '算出不可' : '比較不可'}</p></div>
      <div className="signal-collection-chart"><p><strong>収録データの内訳</strong><span>入力収録 {beforeTotal} → {afterTotal}件</span></p>
        {rows.map((row) => <div className="signal-collection-row" key={row.label}><div><strong>{row.label}</strong><time>{row.date}</time></div><div><div className="signal-collection-bar" role="img" aria-label={row.label + '：対象' + row.count + '件、除外' + row.excluded + '件、入力収録' + row.total + '件'}><span className="signal-bar-target" style={{ width: (row.count / barScale * 100) + '%' }} /><span className="signal-bar-excluded" style={{ width: (row.excluded / barScale * 100) + '%' }} /></div><p><span>対象 {row.count}</span><span>除外 {row.excluded}</span></p></div></div>)}
        <p className="signal-subtle">除外＝企業・分類の対象外や品質上の保留。</p>
      </div>
    </div>
    {signal.counts.comparable ? <p className="signal-delta-reading">{signal.counts.newlyObserved === 0 ? <><strong>この範囲での新規観測は0件です。</strong>次は既存の対象から、図面や製品との対応を調べます。</> : <><strong>収録内で新しく見つかった対象があります。</strong>保存された根拠から、詳しく見る対象を選びます。</>}</p> : <p className="signal-delta-reading">収録条件が異なるため、増減・新規観測は比較できません。</p>}
    <details className="signal-details signal-scope-definitions" data-print-evidence><summary>比較の意味・集計内訳・収録経緯</summary>
      <p>保存された2つの収録集合を比べています。<strong>AI分析の前回・今回の比較ではありません。</strong>基準日は商品の発表日ではなく、図面A/Bも商品の世代順を意味しません。</p>
      <p>この企業・分類・収録範囲の件数です。件数が同じでも、形状や商品が変わっていないとは判断できません。</p>
      <p>新規観測は、後の集合の対象にあり、前の集合の対象にない意匠です。新商品や新しい形状の数ではありません。継続は両方に含まれる対象数で、保存された後の件数から新規観測数を引いて表示しています。</p>
      <p>入力収録件数（対象＋除外）：{beforeTotal}件 → {afterTotal}件。除外：{signal.counts.excludedBefore}件 → {signal.counts.excludedAfter}件。理由別の件数はこの結果には保存されていません。</p>
      <p>除外は、前の対象が後で消えた件数ではありません。{canDerive ? '前の対象のうち後に含まれない件数は、前 − 継続で' + (signal.counts.before - continuing) + '件です。' : '前の対象のうち後に含まれない件数は、ここでは算出できません。'}</p>
      {!signal.counts.comparable ? <><p>比較できない理由・収録上の制約：</p><ul>{signal.limitations.length ? signal.limitations.map((item, index) => <li key={index}>{item}</li>) : <li>個別の理由は保存されていません。収録条件を確認してください。</li>}</ul></> : null}
      <SavedContext run={run} />
    </details>
  </div>;
}

export function SignalSelectedRecord({ signal, recordId }: { signal: SignalV2; recordId: string }) {
  const fact = signal.recordFacts.find((item) => item.recordId === recordId);
  if (!fact) return null;
  const media = signal.media.filter((item) => item.recordId === fact.recordId);
  return <><h3>選択中：{fact.articleName ?? '物品名不明'} · 登録 {fact.registrationNumber ?? '不明'}</h3>
    <div className="signal-investigation-prompt" aria-labelledby="signal-investigation-question">
      <p className="signal-eyebrow">次に調べる問い · 閲覧の案内</p>
      <h4 id="signal-investigation-question">{media.length ? 'この登録意匠と、公式資料の製品との対応を確認できるか？' : 'この登録意匠の形を、どの図面で確認できるか？'}</h4>
      {media.length ? <>
        <p><strong>いま見られる根拠：</strong>この意匠の保存図面 {media.length}点。図面があることだけでは、販売商品・型番との対応は確定できません。</p>
        <p><strong>次に必要な資料：</strong>製品写真・仕様と、この意匠の他の方向の図。外形や部位を照合し、対応を確かめてから設計上の意味を検討します。</p>
        <div className="signal-evidence-links">{media.map((item) => <a key={item.id} href={`#${evidenceId(item.id)}`}>{item.label}を見る</a>)}</div>
        <a className="signal-text-button" href="#signal-approved-drawings">保存された比較組で、図面の着目点を見る →</a>
        {signal.officialFacts.length ? <p><a className="signal-text-button" href="#signal-approved-sources">対応未確認の公式引用を確かめる →</a></p> : <p className="signal-subtle">この結果には公式引用が保存されていません。製品の公式資料も必要です。</p>}
      </> : <>
        <p><strong>いま見られる根拠：</strong>書誌事項です。この結果に図面は保存されていません。</p>
        <p><strong>まず必要な資料：</strong>{fact.registrationNumber ? `登録 ${fact.registrationNumber} に対応する図面` : '選択した意匠に対応する図面'}。下の書誌事項で対象を確かめ、その図面で外形や部位を確認するのが次の一歩です。</p>
      </>}
      <p className="signal-subtle">保存資料から次の確認を考えるための案内です。保存されたAIの問い・回答ではありません。閲覧では新しい分析や資料取得は始まりません。</p>
    </div>
    <details className="signal-details" data-print-evidence><summary>選択した意匠の書誌事項・採用理由</summary><RecordFact fact={fact} /></details>
  </>;
}

export function SignalScopeEvidence({ run }: { run: RunV23 }) {
  const { selectedId, select } = useContext(RecordSelectionContext);
  const selection = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedId) return;
    selection.current?.focus({ preventScroll: true });
    selection.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [selectedId]);
  const signal = run.signal;
  if (!signal) return null;
  const continuing = signal.counts.after - signal.counts.newlyObserved;
  const canLabelNew = signal.counts.comparable && signal.counts.newlyObserved > 0 && continuing >= 0 && continuing <= signal.counts.before
    && signal.recordFacts.filter((fact) => fact.selectionReason === 'newly_observed').length <= signal.counts.newlyObserved;
  const isNew = (fact: SignalV2['recordFacts'][number]) => canLabelNew && fact.selectionReason === 'newly_observed';
  const groups = [
    { label: 'この収録で新しく見つかった対象', facts: signal.recordFacts.filter(isNew) },
    { label: '図面から調べる', facts: signal.recordFacts.filter((fact) => !isNew(fact) && signal.media.some((item) => item.recordId === fact.recordId)) },
    { label: 'まず図面を補う', facts: signal.recordFacts.filter((fact) => !isNew(fact) && !signal.media.some((item) => item.recordId === fact.recordId)) },
  ].filter((group) => group.facts.length);
  return <section className="signal-panel signal-scope-entry" id="signal-approved-scope" tabIndex={-1} aria-labelledby="signal-approved-scope-title">
    <p className="signal-eyebrow">企業・分野の差分から、次に調べる対象へ</p>
    <SignalScopeSummary run={run} />
    {run.input.context.entity.name ? <SignalEditorialEntry key={run.input.context.entity.name} companyName={run.input.context.entity.name} /> : null}
    <h2 id="signal-scope-picker-title" tabIndex={-1}>意匠から調べる · 根拠 {signal.recordFacts.length}件</h2><p className="signal-subtle">保存資料の有無で整理しています。対象全件の一覧とは限りません。物品名は販売商品名・型番とは区別します。</p>
    <div className="signal-scope-groups" role="group" aria-labelledby="signal-scope-picker-title">{groups.map((group) => <div className="signal-scope-group" key={group.label}><h3>{group.label} <span>{group.facts.length}件</span></h3><div className="signal-scope-picker">{group.facts.map((fact) => {
      const media = signal.media.filter((item) => item.recordId === fact.recordId);
      return <button className="signal-scope-candidate" type="button" key={fact.id} id={evidenceId(fact.id)} aria-pressed={selectedId === fact.recordId} aria-controls="signal-selected-record" onClick={() => select(fact.recordId)}><strong>{fact.articleName ?? '物品名不明'} · 登録 {fact.registrationNumber ?? '不明'}</strong>
        <span>{fact.selectionReason === 'newly_observed' && !canLabelNew ? '保存された根拠意匠 · 新規性はここでは判定しません' : { comparison_pair: '図面の比較対象', newly_observed: 'この収録範囲で新規観測', scope_sample: '対象範囲から選ばれた参考資料' }[fact.selectionReason]}</span><span>{media.length ? `保存図面 ${media.length}点` : '書誌事項のみ · 保存図面なし'}</span>
      </button>;
    })}</div></div>)}</div>
    <div ref={selection} className="signal-scope-selection" id="signal-selected-record" tabIndex={-1} aria-live="polite">{selectedId ? <SignalSelectedRecord signal={signal} recordId={selectedId} /> : <p>対象を選ぶと、その意匠の書誌事項と保存された図面への入口を表示します。新しい分析は始まりません。</p>}</div>
  </section>;
}

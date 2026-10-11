import { useContext, useEffect, useRef } from 'react';
import type { RunV23, SignalV2 } from './contract';
import { classificationSchemeLabel, evidenceId } from './labels';
import { RecordFact, SavedContext } from './SignalContext';
import { RecordSelectionContext } from './record-selection';

export function SignalScopeSummary({ run }: { run: RunV23 }) {
  const signal = run.signal;
  if (!signal) return null;
  const { context } = run.input;
  const articles = [...new Set(signal.recordFacts.map((fact) => fact.articleName ?? '物品名不明'))];
  const continuing = signal.counts.after - signal.counts.newlyObserved;
  const canDerive = signal.counts.comparable && continuing >= 0 && continuing <= signal.counts.before;
  return <div className="signal-scope-summary" aria-label="企業・分類の収録範囲の比較">
    <h3>{context.entity.name ?? '企業名不明'}</h3>
    <p><strong>根拠資料の物品名：</strong>{articles.join(' / ') || '未収録'}</p>
    <p className="signal-subtle">対象分類：{context.category.label} · {classificationSchemeLabel(context.category.scheme)}</p>
    <p className="signal-scope-dates">収録基準日<br /><time>{context.beforeDataset.dataAsOf}</time> → <time>{context.afterDataset.dataAsOf}</time></p>
    <div className="signal-counts"><div><span>前の集合の対象</span><strong>{signal.counts.before}<small>件</small></strong></div><div><span>後の集合の対象</span><strong>{signal.counts.after}<small>件</small></strong></div><div><span>新規観測</span><strong>{signal.counts.comparable ? <>{signal.counts.newlyObserved}<small>件</small></> : <small>比較不可</small>}</strong></div><div><span>両集合に収録（算出）</span><strong>{canDerive ? <>{continuing}<small>件</small></> : <small>{signal.counts.comparable ? '算出不可' : '比較不可'}</small>}</strong></div></div>
    <p className="signal-subtle">{signal.counts.comparable ? 'この企業・分類・収録範囲の件数です。件数が同じでも、形状や商品が変わっていないとは判断できません。' : '収録条件が異なるため、増減・新規観測は比較できません。'}</p>
    {signal.counts.comparable && signal.counts.newlyObserved === 0 ? <p className="signal-empty-delta"><strong>この範囲での新規観測は0件です。</strong>既存の対象から、詳しく確認する意匠を選べます。</p> : null}
    {!signal.counts.comparable ? <><p>比較できない理由・収録上の制約：</p><ul>{signal.limitations.length ? signal.limitations.map((item, index) => <li key={index}>{item}</li>) : <li>個別の理由は保存されていません。下の企業・分類・収録条件を確認してください。</li>}</ul></> : null}
    <details className="signal-details" data-print-evidence><summary>新規・継続・除外の意味と集計内訳</summary>
      <p>新規観測は、後の集合の対象にあり、前の集合の対象にない意匠です。新商品や新しい形状の数ではありません。継続は両方に含まれる対象数で、保存された後の件数から新規観測数を引いて表示しています。</p>
      <p>入力収録件数（対象＋除外）：{signal.counts.before + signal.counts.excludedBefore}件 → {signal.counts.after + signal.counts.excludedAfter}件。除外：{signal.counts.excludedBefore}件 → {signal.counts.excludedAfter}件。企業・分類の対象外や品質上の保留などが除外条件です。理由別の件数はこの結果には保存されていません。</p>
      <p>除外は、前の対象が後で消えた件数ではありません。{canDerive ? `前の対象のうち後に含まれない件数は、前 − 継続で${signal.counts.before - continuing}件です。` : '前の対象のうち後に含まれない件数は、ここでは算出できません。'}</p>
    </details>
  </div>;
}

export function SignalSelectedRecord({ signal, recordId }: { signal: SignalV2; recordId: string }) {
  const fact = signal.recordFacts.find((item) => item.recordId === recordId);
  if (!fact) return null;
  const media = signal.media.filter((item) => item.recordId === fact.recordId);
  return <><h3>選択中：{fact.articleName ?? '物品名不明'} · 登録 {fact.registrationNumber ?? '不明'}</h3>
    {media.length ? <><p>この意匠に保存された図面から、観察と公式情報の対応を確かめます。</p><div className="signal-evidence-links">{media.map((item) => <a key={item.id} href={`#${evidenceId(item.id)}`}>{item.label}を見る</a>)}</div><a className="signal-text-button" href="#signal-approved-drawings">保存された比較組で、図面の着目点を見る →</a></> : <p className="signal-subtle">この結果に図面は保存されていません。ここで確認できるのは書誌事項です。形状の確認には、この意匠の図面が必要です。</p>}
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
  return <section className="signal-panel signal-scope-entry" id="signal-approved-scope" tabIndex={-1} aria-labelledby="signal-approved-scope-title">
    <p className="signal-eyebrow">1 · 企業・分類の差分から、今回詳しく見る対象を選ぶ</p><h2 id="signal-approved-scope-title">保存された収録差分</h2>
    <SignalScopeSummary run={run} />
    <p>保存された2つの収録集合を比べています。基準日は商品の発表日ではなく、図面A/Bも商品の世代順を意味しません。</p>
    <details className="signal-details" data-print-evidence><summary>集計に使った企業・分類・収録経緯を見る</summary><SavedContext run={run} /></details>
    <h3 id="signal-scope-picker-title" tabIndex={-1}>今回詳しく見る対象を選ぶ · 根拠意匠 {signal.recordFacts.length}件</h3><p className="signal-subtle">この結果に保存された資料から選びます。対象全件の一覧とは限りません。物品名は販売商品名・型番とは区別します。</p>
    <div className="signal-scope-picker" role="group" aria-labelledby="signal-scope-picker-title">{signal.recordFacts.map((fact) => {
      const media = signal.media.filter((item) => item.recordId === fact.recordId);
      return <button className="signal-scope-candidate" type="button" key={fact.id} id={evidenceId(fact.id)} aria-pressed={selectedId === fact.recordId} aria-controls="signal-selected-record" onClick={() => select(fact.recordId)}><strong>{fact.articleName ?? '物品名不明'} · 登録 {fact.registrationNumber ?? '不明'}</strong>
        <span>{{ comparison_pair: '図面の比較対象', newly_observed: 'この収録範囲で新規観測', scope_sample: '対象範囲から選ばれた参考資料' }[fact.selectionReason]}</span><span>{media.length ? `保存図面 ${media.length}点` : '書誌事項のみ · 保存図面なし'}</span>
      </button>;
    })}</div>
    <div ref={selection} className="signal-scope-selection" id="signal-selected-record" tabIndex={-1} aria-live="polite">{selectedId ? <SignalSelectedRecord signal={signal} recordId={selectedId} /> : <p>対象を選ぶと、その意匠の書誌事項と保存された図面への入口を表示します。新しい分析は始まりません。</p>}</div>
  </section>;
}

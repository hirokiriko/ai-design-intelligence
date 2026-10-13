import type { ObservationPlan, RunV26 } from './contract';
import { sourceDisplayTitle } from './source-display';
import { publicationCondition } from './confirmation-guide';
import './signal-observation-plan.css';

export function SignalObservationReason({ plan, held = false }: { plan: ObservationPlan; held?: boolean }) {
  return <div className="signal-ai-reason" data-observation-id={plan.observationId}>
    <strong>保存AIの注目理由</strong><p>{plan.reason}</p>
    {held ? <p className="signal-focus-caution">この理由の品質評価は未達です。採用を保留しています。</p> : null}
  </div>;
}

export function SignalObservationAssessment({ run, plan, held = false }: { run: RunV26; plan: ObservationPlan; held?: boolean }) {
  const signal = run.signal;
  if (!signal) return null;
  const observation = signal.visualObservations.find(item => item.id === plan.observationId);
  const assessment = plan.officialAssessment;
  const facts = assessment.factIds.map(id => signal.officialFacts.find(fact => fact.id === id)).filter(fact => fact !== undefined);
  const media = signal.media.filter(item => observation?.mediaIds.includes(item.id));
  return <section className="signal-ai-assessment" data-observation-id={plan.observationId} aria-label="この箇所への保存AI引用評価">
    <h4>保存AIの引用評価</h4><p>対象：{observation?.part ?? '保存された観察'}</p>
    <p className="signal-badge">{{ supports: 'AI評価：支持する', conflicts: 'AI評価：食い違う', unverified: 'AI評価：対応は未確認' }[assessment.stance]}</p>
    <p>{assessment.basis}</p><p className="signal-subtle">保存されたAIの評価です。引用と図面の対応が人により確認済みという意味ではありません。</p>
    {held ? <p className="signal-focus-caution">引用・対応評価の品質は未達です。採用を保留しています。</p> : null}
    <div className="signal-ai-date-context"><strong>保存された日付・比較条件</strong>
      <p>基準日：比較A {run.input.context.beforeDataset.dataAsOf} / 比較B {run.input.context.afterDataset.dataAsOf}</p>
      {media.map(item => <p key={item.id}>{item.role === 'comparisonA' ? '図面A' : '図面B'}：出願日 {item.applicationDate ?? '不明'} / 公報日 {item.gazetteDate ?? '不明'}</p>)}
      <p className="signal-subtle">基準日・公報日・発表日・発売日・取得日時は別の情報です。日付だけで製品世代や因果関係は判断できません。</p>
    </div>
    {facts.length ? facts.map(fact => {
      const source = signal.sources.find(item => item.id === fact.sourceId);
      return <article className="signal-ai-plan-quote" key={fact.id} data-fact-id={fact.id}>
        <h5>{sourceDisplayTitle(source?.title ?? '')}</h5><blockquote>{fact.quote}</blockquote>
        <details><summary>引用についての保存文</summary><p>{fact.text}</p><p className="signal-subtle">保存された引用位置：{fact.start}〜{fact.end}（先頭0、終端を含まない）</p></details>
        {source ? <><dl className="signal-reference-date-list"><dt>発表日</dt><dd>{source.publishedAt ?? '不明'}</dd><dt>更新日</dt><dd>{source.updatedAt ?? '不明'}</dd><dt>発売日</dt><dd>{source.releaseAt ?? '不明'}</dd><dt>取得日時</dt><dd>{source.retrievedAt}</dd></dl>
          <p><strong>保存日付の照合（固定表示）：</strong>{publicationCondition(source.publishedAt, run.input.context.beforeDataset.dataAsOf, run.input.context.afterDataset.dataAsOf)}</p>
          {source.retrospective ? <p>事後に補足した資料として保存されています。</p> : null}
          {source.truncated ? <p>分析用抜粋には省略があります。全文を確認したことにはなりません。</p> : null}
          <a href={source.url} target="_blank" rel="noopener noreferrer">公式の出典を開く ↗</a></> : null}
      </article>;
    }) : <p>この評価が参照する公式引用はありません。</p>}
  </section>;
}

export function SignalObservationNextPlan({ plan, held = false }: { plan: ObservationPlan; held?: boolean }) {
  return <section className="signal-ai-next-plan" data-observation-id={plan.observationId} aria-label="この箇所の保存AI調査計画">
    <h4>保存AIの次の調査</h4><p className="signal-subtle">この観察に結び付けて保存されたAI提案です。固定の確認ガイドとは別の内容です。</p>
    {held ? <p className="signal-focus-caution">この調査提案の品質評価は未達です。有用性の確認は完了していません。</p> : null}
    <dl className="signal-ai-plan-fields"><dt>調べる資料</dt><dd>{plan.material}</dd><dt>確認する箇所</dt><dd>{plan.location}</dd><dt>確認したい条件</dt><dd>{plan.condition}</dd><dt>確認できた場合の判断</dt><dd>{plan.decision}</dd><dt>保留する条件</dt><dd>{plan.hold}</dd></dl>
  </section>;
}

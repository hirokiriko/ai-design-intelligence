import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import sample from './backend-run-v2.6.fixture.json';
import oldSample from './backend-run-v2.5.fixture.json';
import { ContractError, decodeRun, decodeRuns, type ObservationPlan, type RunV26 } from './contract';
import { SignalObservationAssessment, SignalObservationNextPlan, SignalObservationReason } from './SignalObservationPlan';
import { SignalResult } from './SignalResult';
import { SignalHistory } from './SignalHistory';

function fixture(): RunV26 {
  const run = decodeRun(structuredClone(sample));
  if (run.schemaVersion !== '2.6.0' || !run.signal) throw new Error('FIXTURE_REQUIRES_OBSERVATION_PLANS');
  return run;
}
const plans = (run: RunV26) => run.signal!.questionAnswer.observationPlans;

describe('typed saved observation plans v2.6', () => {
  it('decodes the unchanged Backend golden and mixed old history without promotion', () => {
    const original = JSON.stringify(sample), old = JSON.stringify(oldSample);
    const run = fixture();
    expect(plans(run).map(plan => plan.observationId).sort()).toEqual(run.signal!.visualObservations.map(item => item.id).sort());
    const history = decodeRuns({ schemaVersion: '2.3.0', runs: [run, oldSample] });
    expect('observationPlans' in (history[1] as RunV26).signal!.questionAnswer).toBe(false);
    expect(JSON.stringify(sample)).toBe(original); expect(JSON.stringify(oldSample)).toBe(old);
    const html = renderToStaticMarkup(createElement(SignalHistory, { runs: history, state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(html).toContain(run.input.analysisQuestion.text);
    expect(html).toContain(run.input.comparisonPair!.label);
  });
  it.each(['missing', 'duplicate', 'foreign'] as const)('rejects %s observation coverage', variant => {
    const run = fixture();
    if (variant === 'missing') plans(run).pop();
    if (variant === 'duplicate') plans(run)[1].observationId = plans(run)[0].observationId;
    if (variant === 'foreign') plans(run)[0].observationId = 'FIXTURE-foreign-observation';
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it('matches the public ten-observation/plan bound', () => {
    const run = fixture(), signal = run.signal!;
    while (signal.visualObservations.length < 10) {
      const id = `FIXTURE-bound-${signal.visualObservations.length}`;
      signal.visualObservations.push({ ...signal.visualObservations[0], id });
      plans(run).push({ ...structuredClone(plans(run)[0]), observationId: id });
    }
    expect(() => decodeRun(run)).not.toThrow();
    signal.visualObservations.push({ ...signal.visualObservations[0], id: 'FIXTURE-eleventh' });
    plans(run).push({ ...structuredClone(plans(run)[0]), observationId: 'FIXTURE-eleventh' });
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it.each(['foreign', 'source', 'visual', 'duplicate'] as const)('rejects %s official references', variant => {
    const run = fixture(), signal = run.signal!;
    plans(run)[0].officialAssessment.factIds = variant === 'foreign' ? ['FIXTURE-foreign-fact'] : variant === 'source' ? [signal.sources[0].id] : variant === 'visual' ? [signal.visualObservations[0].id] : [signal.officialFacts[0].id, signal.officialFacts[0].id];
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it.each(['supports', 'conflicts'] as const)('requires quotes for AI %s and preserves the stance as an assessment', stance => {
    const run = fixture(), plan = plans(run)[0]; plan.officialAssessment.stance = stance;
    plan.officialAssessment.factIds = []; expect(() => decodeRun(run)).toThrow(ContractError);
    plan.officialAssessment.factIds = [run.signal!.officialFacts[0].id]; expect(() => decodeRun(run)).not.toThrow();
    const html = renderToStaticMarkup(createElement(SignalObservationAssessment, { run, plan }));
    expect(html).toContain(stance === 'supports' ? 'AI評価：支持する' : 'AI評価：食い違う');
    expect(html).toContain('人により確認済みという意味ではありません');
  });
  it.each(['reason', 'material', 'location', 'condition', 'decision', 'hold', 'basis'] as const)('bounds nonblank %s in Unicode characters', field => {
    const run = fixture(), plan = plans(run)[0];
    const target = field === 'basis' ? plan.officialAssessment : plan;
    const set = (value: string) => { (target as unknown as Record<string, string>)[field] = value; };
    set(' '); expect(() => decodeRun(run)).toThrow(ContractError);
    set('𠮷'.repeat(240)); expect(() => decodeRun(run)).not.toThrow();
    set('𠮷'.repeat(241)); expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it('rejects extra fields, an unknown stance, overlong IDs and old-schema plan injection', () => {
    for (const mutate of [
      (plan: ObservationPlan) => Object.assign(plan, { inferredDate: '2026-01-01' }),
      (plan: ObservationPlan) => Object.assign(plan.officialAssessment, { stance: 'neutral' }),
      (plan: ObservationPlan) => { plan.observationId = 'F'.repeat(161); },
      (plan: ObservationPlan) => { plan.officialAssessment.factIds = Array.from({ length: 21 }, (_, i) => `FIXTURE-fact-${i}`); },
    ]) { const run = fixture(); mutate(plans(run)[0]); expect(() => decodeRun(run)).toThrow(ContractError); }
    const old = structuredClone(oldSample); Object.assign(old.signal.questionAnswer, { observationPlans: [] });
    expect(() => decodeRun(old)).toThrow(ContractError);
  });
  it.each(['\n', '\u202e', '\ud800'])('rejects forbidden Unicode categories only in new plan strings (%j)', forbidden => {
    for (const field of ['reason', 'material', 'location', 'condition', 'decision', 'hold', 'basis', 'observationId', 'factIds'] as const) {
      const run = fixture(), plan = plans(run)[0];
      if (field === 'basis') plan.officialAssessment.basis += forbidden;
      else if (field === 'factIds') plan.officialAssessment.factIds = [`FIXTURE-fact${forbidden}`];
      else plan[field] += forbidden;
      expect(() => decodeRun(run)).toThrow(ContractError);
    }
    const old = structuredClone(oldSample); old.signal.questionAnswer.text += forbidden;
    expect(() => decodeRun(old)).not.toThrow();
  });
  it('accepts insufficiency with typed plans and no global prose or limits', () => {
    const run = fixture(), answer = run.signal!.questionAnswer;
    answer.status = 'insufficient'; answer.nextChecks = []; answer.limitations = [];
    expect(() => decodeRun(run)).not.toThrow();
    run.signal!.visualObservations = []; answer.observationPlans = []; answer.evidenceIds = []; answer.supportingEvidenceIds = []; answer.opposingEvidenceIds = []; run.signal!.hypotheses = []; run.signal!.relationships = [];
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it('retains partial observations but requires an empty not-evaluated answer and plans', () => {
    const run = fixture(), originalObservations = JSON.stringify(run.signal!.visualObservations);
    run.status = 'partial';
    expect(() => decodeRun(run)).toThrow(ContractError);
    const previous = plans(run)[0];
    run.signal!.questionAnswer = { questionId: run.input.analysisQuestion.id, questionVersion: '1.0.0', status: 'not_evaluated', text: null, evidenceIds: [], supportingEvidenceIds: [], opposingEvidenceIds: [], nextChecks: [], limitations: [], observationPlans: [] };
    expect(() => decodeRun(run)).not.toThrow();
    expect(JSON.stringify(run.signal!.visualObservations)).toBe(originalObservations);
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('この問いへの回答はまだ得られていません');
    expect(html).not.toContain('class="signal-ai-saved-plan"');
    plans(run).push(previous); expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it('renders only the referenced quote with exact dates, preserves null and escapes all AI prose', () => {
    const run = fixture(), plan = plans(run)[1], signal = run.signal!;
    const fact = signal.officialFacts.find(item => item.id === plan.officialAssessment.factIds[0])!;
    const source = signal.sources.find(item => item.id === fact.sourceId)!;
    source.publishedAt = null; source.releaseAt = '2026-09-24'; source.updatedAt = null;
    plan.officialAssessment.basis = '<script>FIXTURE-assessment</script>';
    const before = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(SignalObservationAssessment, { run, plan, held: true }));
    expect(html).toContain(fact.quote); expect(html).toContain(`<dt>発表日</dt><dd>不明</dd>`);
    expect(html).toContain('<dt>発売日</dt><dd>2026-09-24</dd>'); expect(html).toContain(source.retrievedAt);
    expect(html).toContain(run.input.context.beforeDataset.dataAsOf); expect(html).toContain(run.input.context.afterDataset.dataAsOf);
    expect(html).toContain('&lt;script&gt;FIXTURE-assessment&lt;/script&gt;'); expect(html).not.toContain('<script>');
    expect(html).toContain('品質は未達'); expect(JSON.stringify(run)).toBe(before);
    plan.officialAssessment.factIds = [];
    const noRefs = renderToStaticMarkup(createElement(SignalObservationAssessment, { run, plan }));
    expect(noRefs).not.toContain(fact.quote); expect(noRefs).toContain('参照する公式引用はありません');
  });
  it('renders all typed plans from saved history separately from fixed helpers and retains quality holds', () => {
    const run = fixture(), before = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    for (const plan of plans(run)) {
      for (const field of ['reason', 'material', 'location', 'condition', 'decision', 'hold'] as const) expect(html).toContain(plan[field]);
    }
    expect(html).toContain('固定の確認ガイドとは別');
    const reason = renderToStaticMarkup(createElement(SignalObservationReason, { plan: plans(run)[0], held: true }));
    const next = renderToStaticMarkup(createElement(SignalObservationNextPlan, { plan: plans(run)[0], held: true }));
    expect(reason).toContain('採用を保留'); expect(next).toContain('有用性の確認は完了していません');
    expect(JSON.stringify(run)).toBe(before);
  });
  it('keeps known after-window and missing publication dates distinct within one saved run', () => {
    const run = fixture(), signal = run.signal!, plan = plans(run)[0];
    const fact = signal.officialFacts[0], source = signal.sources.find(item => item.id === fact.sourceId)!;
    source.publishedAt = '2027-01-01'; source.retrospective = true;
    const unknownSource = { ...source, id: 'FIXTURE-unknown-date-source', publishedAt: null, retrospective: false };
    const unknownFact = { ...fact, id: 'FIXTURE-unknown-date-fact', sourceId: unknownSource.id };
    // Keep within the public three-source bound while using the exact saved quote/excerpt.
    signal.sources = [source, unknownSource]; signal.officialFacts = [fact, unknownFact];
    plan.officialAssessment.factIds = [fact.id, unknownFact.id];
    expect(() => decodeRun(run)).not.toThrow();
    const before = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(SignalObservationAssessment, { run, plan }));
    expect(html).toContain('<dt>発表日</dt><dd>2027-01-01</dd>');
    expect(html).toContain('<dt>発表日</dt><dd>不明</dd>');
    expect(html).toContain('比較Bの基準日より後の発表です');
    expect(html).toContain('事後に補足した資料として保存されています');
    expect(html).toContain('取得日時から発表時期を推測できません');
    expect(html).toContain('保存日付の照合（固定表示）');
    expect(html).not.toContain('発表日は保存されたA/B基準日の範囲内');
    expect(JSON.stringify(run)).toBe(before);
  });
});

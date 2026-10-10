import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import sample from './backend-run-v2.5.fixture.json';
import { analysisQuestion, isAnalysisQuestion } from './analysis-question';
import { ContractError, decodeBootstrap, decodeRun, decodeRuns, type RunV25 } from './contract';
import { fictionalBootstrapV2 } from './fixtures';
import { fictionalRunV22 } from './fixtures-v22';
import { SignalResult } from './SignalResult';
import { SignalHistory } from './SignalHistory';
import { SignalQuestionPicker } from './SignalPurposeJourney';

function questionRun(): RunV25 {
  const run = decodeRun(structuredClone(sample));
  if (run.schemaVersion !== '2.5.0') throw new Error('Unexpected question fixture version');
  return run;
}
describe('question snapshot, answer references and saved display', () => {
  it('decodes the Backend fictional v2.5 fixture and preserves exact saved purpose and answer', () => {
    const run = decodeRun(questionRun());
    if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('Missing selected question');
    const before = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(SignalResult, { run, developmentMode: true }));
    expect(html).toContain(`実行時の問い：${run.input.analysisQuestion.text}`);
    expect(html).toContain(run.signal.questionAnswer.text);
    expect(html).toContain('固定の模擬回答 · 実AI未実施');
    expect(html).toContain('支持の根拠・図面・引用を確かめる');
    expect(html).toContain(run.signal.questionAnswer.nextChecks[0]);
    expect(html).toContain(run.input.comparisonPair!.label);
    expect(html).not.toContain('実行時の問い：未記録');
    expect(JSON.stringify(run)).toBe(before);
  });
  it('leaves old results unrecorded and reads mixed-version history without backfilling', () => {
    const old = structuredClone(fictionalRunV22);
    const before = JSON.stringify(old);
    const runs = decodeRuns({ schemaVersion: '2.3.0', runs: [questionRun(), old] });
    const html = renderToStaticMarkup(createElement(SignalHistory, { runs, state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(html).toContain('実行時の問い：公式の説明は図面を裏付ける？');
    expect(html).toContain('実行時の問い：未記録');
    expect(JSON.stringify(old)).toBe(before);
    expect(renderToStaticMarkup(createElement(SignalResult, { run: old }))).toContain('実行時の問い：未記録');
  });
  it.each(['questionId', 'questionVersion'] as const)('rejects an answer for a different %s', (field) => {
    const run = questionRun(); run.signal!.questionAnswer[field] = 'wrong' as never;
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it.each(['evidenceIds', 'supportingEvidenceIds', 'opposingEvidenceIds'] as const)('rejects fabricated %s', (field) => {
    const run = questionRun(); run.signal!.questionAnswer[field] = ['kds_fixture_foreign_evidence'];
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it('rejects a source or image ID masquerading as answer evidence', () => {
    for (const id of [sample.signal!.sources[0].id, sample.signal!.media[0].id]) {
      const run = questionRun(); run.signal!.questionAnswer.evidenceIds = [id]; run.signal!.questionAnswer.supportingEvidenceIds = [id];
      expect(() => decodeRun(run)).toThrow(ContractError);
    }
  });
  it('rejects overlap and support outside the answer evidence set', () => {
    const run = questionRun(); const answer = run.signal!.questionAnswer;
    answer.opposingEvidenceIds = [...answer.supportingEvidenceIds];
    expect(() => decodeRun(run)).toThrow(ContractError);
    answer.opposingEvidenceIds = []; answer.evidenceIds = [];
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it('does not turn an unanswered snapshot into a complete answer', () => {
    const run = questionRun();
    run.status = 'partial';
    expect(() => decodeRun(run)).toThrow(ContractError);
    run.status = 'complete';
    run.signal!.questionAnswer = { questionId: 'support', questionVersion: '1.0.0', status: 'not_evaluated', text: null, evidenceIds: [], supportingEvidenceIds: [], opposingEvidenceIds: [], nextChecks: [], limitations: [] };
    expect(() => decodeRun(run)).toThrow(ContractError);
    run.status = 'partial'; run.errorCode = 'MODEL_QUESTION_ANSWER_INVALID';
    const html = renderToStaticMarkup(createElement(SignalResult, { run: decodeRun(run) }));
    expect(html).toContain('この問いへの回答はまだ得られていません');
    expect(html).not.toContain('回答あり');
    run.signal!.questionAnswer.text = 'invented'; expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it('allows honest insufficiency only with an explanation and concrete limits or next checks', () => {
    const run = questionRun(); const answer = run.signal!.questionAnswer;
    answer.status = 'insufficient'; answer.evidenceIds = []; answer.supportingEvidenceIds = []; answer.opposingEvidenceIds = [];
    expect(() => decodeRun(run)).not.toThrow();
    answer.nextChecks = []; answer.limitations = [];
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it('rejects unknown, altered, additional and inherited question fields', () => {
    const run = questionRun(); run.input.analysisQuestion.text = 'a different purpose';
    expect(() => decodeRun(run)).toThrow(ContractError);
    expect(isAnalysisQuestion({ ...analysisQuestion('drawings'), extra: true })).toBe(false);
    const inherited = Object.assign(Object.create(analysisQuestion('drawings')), { a: 1, b: 2, c: 3 });
    expect(isAnalysisQuestion(inherited)).toBe(false);
  });
  it('negotiates capability explicitly and keeps legacy Bootstrap shape strict', () => {
    const capability = { ...structuredClone(fictionalBootstrapV2), schemaVersion: '2.5.0', analysisMode: 'standard', analysisQuestionVersion: '1.0.0' };
    expect(decodeBootstrap(capability).analysisQuestionVersion).toBe('1.0.0');
    expect(() => decodeBootstrap({ ...capability, schemaVersion: '2.4.0' })).toThrow(ContractError);
    expect(() => decodeBootstrap({ ...capability, analysisQuestionVersion: '2.0.0' })).toThrow(ContractError);
    expect(() => decodeBootstrap({ ...capability, dataMode: 'approved_public', analysisMode: 'facts_only' })).toThrow(ContractError);
  });
  it('explains recorded analysis purpose without starting a run when selected', () => {
    const html = renderToStaticMarkup(createElement(SignalQuestionPicker, { selected: 'support', disabled: false, analysisSupported: true, onSelect: () => undefined }));
    expect(html).toContain('分析する問いを選ぶ');
    expect(html).toContain('開始時の問いを分析入力に渡し');
    expect(html).toContain('この選択だけでは分析は始まりません');
    expect(html).toContain('今見ている保存結果の問いは変わりません');
  });
});

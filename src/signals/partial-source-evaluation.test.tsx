import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContractError, decodeRun, decodeRuns, type Run, type Signal } from './contract';
import { fictionalRunV2 } from './fixtures';
import { evidenceId, partialSourceEvaluationRun, runStatusLabel } from './labels';
import { SignalHistory } from './SignalHistory';
import { SignalResult } from './SignalResult';

const partialLabel = '一部資料を取得できず、取得済み資料で確認した途中結果';
const event = (tool: string, outcome: string): Signal['toolEvents'][number] => ({
  tool, outcome, candidateId: tool === 'fetch_candidate' ? 'candidate-unread' : null,
  reason: tool === 'finish' ? '取得済みの資料だけを評価しました。' : '許可境界で資料取得を停止しました。',
  startedAt: '2026-07-01T01:00:04Z', finishedAt: '2026-07-01T01:00:05Z',
});
const evaluatedRun = () => {
  const run = structuredClone(fictionalRunV2);
  run.status = 'partial'; run.errorCode = 'URL_REJECTED'; run.versions.prompt = 'bounded-signal-2.5.0';
  run.signal!.toolEvents.push(event('fetch_candidate', 'URL_REJECTED_REDIRECT_HOST'), event('finish', 'ok'));
  run.signal!.discovery.candidates.push({ ...run.signal!.discovery.candidates[0], id: 'candidate-unread', url: 'https://leaf.example.test/news/supplement', title: '未取得の架空補足資料' });
  run.signal!.discovery.eligibleCandidates = 2;
  return run;
};
const render = (run: Run) => renderToStaticMarkup(createElement(SignalResult, { run }));

describe('saved evaluation limited to retrieved sources after URL rejection', () => {
  it('shows useful partial evaluation, its citations and limitations without promoting it to complete', () => {
    const run = evaluatedRun();
    const saved = JSON.stringify(run);
    expect(decodeRun(run)).toEqual(run);
    expect(decodeRuns({ schemaVersion: '2.3.0', runs: [run] })).toEqual([run]);
    expect(partialSourceEvaluationRun(run)).toBe(true);
    const html = render(run);
    expect(html).toContain(partialLabel);
    expect(html).toContain('取得済み資料からの検討材料と未確認事項');
    expect(html).toContain('関連仮説 · 途中結果');
    expect(html).toContain('取得済み資料での対応評価（途中結果）');
    expect(html).toContain('取得済み資料の評価');
    expect(html).toContain('取得できなかった資料は結果の根拠に使っていません');
    expect(html).toContain(run.signal!.officialFacts[0].quote);
    expect(html).toContain(run.signal!.hypotheses[0].text);
    expect(html).toContain(`href="#${evidenceId('official-1')}"`);
    expect(html).toContain(run.signal!.questionsForHuman[0]);
    for (const completed of ['今回わかったこと', '保存された総合判定', 'status-complete', '停止前に取得・検証した参考資料']) expect(html).not.toContain(completed);
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run], state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(history).toContain(partialLabel);
    expect(JSON.stringify(run)).toBe(saved);
  });

  it.each([
    ...['ENTRY', 'REDIRECT'].flatMap((stage) => ['CHARACTERS', 'PARSE', 'SCHEME', 'HOST', 'QUERY', 'USERINFO', 'PORT', 'PATH'].map((condition) => `URL_REJECTED_${stage}_${condition}`)),
    'SOURCE_PATH_NOT_APPROVED_ENTRY', 'SOURCE_PATH_NOT_APPROVED_REDIRECT',
  ])('uses the server-recorded %s rejection followed by validated finish', (outcome) => {
    const run = evaluatedRun();
    run.signal!.toolEvents[1].outcome = outcome;
    if (outcome.startsWith('SOURCE_PATH_NOT_APPROVED')) run.errorCode = 'SOURCE_PATH_NOT_APPROVED';
    expect(runStatusLabel(decodeRun(run))).toBe(partialLabel);
  });

  it('does not manufacture a positive hypothesis when retrieved material is insufficient', () => {
    const run = evaluatedRun();
    run.signal!.hypotheses = [];
    run.signal!.relationships = [{ id: 'unresolved', relation: 'unknown', summary: '取得済み資料だけでは意匠と商品を対応付けられません。', supportingEvidenceIds: ['official-1'], opposingEvidenceIds: [], missingEvidence: ['対応する商品と意匠の資料が必要です。'] }];
    run.signal!.status = 'insufficient';
    const html = render(decodeRun(run));
    expect(html).toContain(partialLabel);
    expect(html).toContain('取得済みの資料から根拠のある関連仮説は得られませんでした');
    expect(html).toContain('途中結果 · 対応不明');
    expect(html).toContain(run.signal!.relationships[0].missingEvidence[0]);
    expect(html).not.toContain(fictionalRunV2.signal!.hypotheses[0].text);
    expect(html).not.toContain('判断する資料が不足');
  });

  it.each(['MODEL_EVIDENCE_QUOTE_NOT_FOUND', 'MODEL_EVIDENCE_RELATIONSHIP_CATEGORY_OFFICIAL_MISSING', 'MODEL_ASSESSMENT_TEXT_INVALID', 'MODEL_FAILURE', 'TIME_BUDGET_EXHAUSTED'])('preserves the original rejection and verified snapshot on secondary %s', (errorCode) => {
    const run = evaluatedRun();
    run.errorCode = errorCode;
    run.signal!.toolEvents.pop();
    const html = render(decodeRun(run));
    expect(html).toContain('停止前に取得・検証した参考資料');
    expect(html).toContain('取得できなかった資料は結果の根拠に使っていません');
    expect(html).toContain('URL_REJECTED_REDIRECT_HOST');
    expect(html).toContain(run.signal!.officialFacts[0].quote);
    expect(html).not.toContain(partialLabel);
    expect(html).not.toContain('取得済み資料からの検討材料と未確認事項');
    expect(html).not.toContain('今回わかったこと');
  });

  it.each(['no-finish', 'finish-before-rejection', 'finish-failed', 'unknown-rejection', 'wrong-tool', 'no-source', 'unreadable-source', 'not-model-visible', 'only-hidden-text-readable', 'legacy-no-events', 'null-snapshot', 'complete', 'failed', 'running', 'interrupted'] as const)('does not infer evaluated partial results from %s', (condition) => {
    const run = evaluatedRun();
    if (condition === 'no-finish') run.signal!.toolEvents.pop();
    if (condition === 'finish-before-rejection') run.signal!.toolEvents.reverse();
    if (condition === 'finish-failed') run.signal!.toolEvents[2].outcome = 'failed';
    if (condition === 'unknown-rejection') run.signal!.toolEvents[1].outcome = 'URL_REJECTED_REDIRECT_UNKNOWN';
    if (condition === 'wrong-tool') run.signal!.toolEvents[1].tool = 'list_candidates';
    if (condition === 'no-source' || condition === 'unreadable-source' || condition === 'not-model-visible' || condition === 'only-hidden-text-readable') {
      run.signal!.officialFacts = []; run.signal!.hypotheses = []; run.signal!.relationships = [];
      if (condition === 'no-source') run.signal!.sources = [];
      if (condition === 'unreadable-source') { run.signal!.sources[0].excerpt = ' '; run.signal!.sources[0].modelVisibleChars = 1; run.signal!.sources[0].extractedChars = 1; }
      if (condition === 'not-model-visible') { run.signal!.sources[0].modelVisibleChars = 0; run.signal!.sources[0].truncated = true; }
      if (condition === 'only-hidden-text-readable') { run.signal!.sources[0].excerpt = ' 本文'; run.signal!.sources[0].modelVisibleChars = 1; run.signal!.sources[0].extractedChars = 3; run.signal!.sources[0].truncated = true; }
    }
    if (condition === 'legacy-no-events') run.signal!.toolEvents = [];
    if (condition === 'null-snapshot') run.signal = null;
    if (['complete', 'failed', 'running', 'interrupted'].includes(condition)) run.status = condition as Run['status'];
    if (condition === 'running') run.completedAt = null;
    expect(partialSourceEvaluationRun(decodeRun(run))).toBe(false);
    expect(render(run)).not.toContain(partialLabel);
  });

  it('continues to reject an invalid quotation even in an otherwise evaluated partial result', () => {
    const run = evaluatedRun();
    run.signal!.officialFacts[0].quote = '保存本文にはない引用';
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
});

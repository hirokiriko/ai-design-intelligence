import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import questionSample from './backend-run-v2.5.fixture.json';
import { decodeRun, type Run, type RunV23 } from './contract';
import { fictionalRunV22 } from './fixtures-v22';
import { evidenceId } from './labels';
import { claimFailedChecks, knownFailedChecks, ResultQualityContext, type ArchivedResultQuality } from './result-quality';
import { reviewMatchesRun, runReviewKey, type PublicRunReview, type ReviewCheck, type RunReviewState } from './run-review';
import { ResultOverview } from './SignalContext';
import { SignalEvidenceDetails } from './SignalEvidenceDetails';
import { SignalQualityHold } from './SignalQualityHold';
import { SignalResult } from './SignalResult';

function fixture(): RunV23 {
  const old = structuredClone(fictionalRunV22);
  const run: RunV23 = {
    ...old, id: 'FIXTURE-QUALITY-RUN', schemaVersion: '2.3.0',
    versions: { model: 'kds_fixture_quality_model', prompt: 'kds_fixture_quality_prompt', schema: '2.3.0' },
    input: { ...old.input, context: { ...old.input.context,
      beforeDataset: { ...old.input.context.beforeDataset, collection: null },
      afterDataset: { ...old.input.context.afterDataset, collection: null },
    } },
  };
  const signal = run.signal!;
  signal.counts = { before: 1, after: 1, newlyObserved: 0, excludedBefore: 0, excludedAfter: 0, comparable: true };
  signal.visualObservations = [{ ...signal.visualObservations[0], id: 'FIXTURE-QUALITY-OBSERVATION',
    part: '架空の観察箇所', observation: '架空図面の短い線についての保存AI記述。', status: 'change_candidate' }];
  signal.hypotheses = [
    { id: 'FIXTURE-QUALITY-DEPENDENT', text: '架空の観察に依存する保存仮説。',
      evidenceIds: [signal.visualObservations[0].id, signal.officialFacts[0].id], limitations: ['架空の依存仮説の限界。'] },
    { id: 'FIXTURE-QUALITY-INDEPENDENT', text: '架空の書誌事項だけからの保存検討。',
      evidenceIds: [signal.designFacts[0].id], limitations: ['架空の書誌による検討の限界。'] },
  ];
  signal.relationships = signal.hypotheses.map((item) => ({ id: item.id, relation: 'candidate',
    summary: `${item.text}の対応候補。`, supportingEvidenceIds: [...item.evidenceIds], opposingEvidenceIds: [],
    missingEvidence: ['架空の対応確認資料が不足しています。'] }));
  for (const source of signal.sources) source.publishedAt = source.updatedAt = source.releaseAt = null;
  return run;
}
function review(run: Run, checks: ReviewCheck[] = ['V2', 'V4']): PublicRunReview {
  return { runId: run.id, schemaVersion: run.schemaVersion, promptVersion: run.versions.prompt, modelId: run.versions.model,
    reviewReference: 'kds_fixture_quality_review', reviewedAt: null, failedChecks: checks, ownerAcceptance: 'NOT_PERFORMED' };
}
function archived(run: Run, checks: readonly ReviewCheck[] = ['V2', 'V4']): ArchivedResultQuality {
  return { subjectKey: runReviewKey(run), failedChecks: checks };
}
function elementById(html: string, id: string): string {
  const marker = html.indexOf(`id="${id}"`);
  if (marker < 0) throw new Error(`Missing fictional result element: ${id}`);
  const start = html.lastIndexOf('<', marker);
  const tag = /^<([a-z][a-z0-9-]*)\b/i.exec(html.slice(start))?.[1];
  if (!tag) throw new Error('Missing element opening tag');
  const tags = new RegExp(`</?${tag}\\b[^>]*>`, 'gi');
  tags.lastIndex = start;
  let depth = 0;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (!depth) return html.slice(start, tags.lastIndex);
  }
  throw new Error('Missing element closing tag');
}

describe('quality metadata stays bound to the exact saved subject', () => {
  it('combines matching API and archived failures without changing any saved input', () => {
    const run = fixture(), api = review(run, ['V2']), archive = archived(run, ['V2', 'V4']);
    const before = JSON.stringify({ run, api, archive });
    expect(knownFailedChecks(run, { status: 'ready', review: api }, archive)).toEqual(['V2', 'V4']);
    expect(JSON.stringify({ run, api, archive })).toBe(before);
  });
  it.each(['runId', 'schemaVersion', 'promptVersion', 'modelId'] as const)('does not apply a review with another %s', (field) => {
    const run = fixture(), wrong = review(run);
    if (field === 'schemaVersion') wrong.schemaVersion = '2.2.0';
    else wrong[field] = 'kds_fixture_other_subject';
    expect(reviewMatchesRun(wrong, run)).toBe(false);
    expect(knownFailedChecks(run, { status: 'ready', review: wrong })).toEqual([]);
  });
  it.each(['id', 'schema', 'prompt', 'model'] as const)('does not apply archived quality after the subject %s changes', (field) => {
    const run = fixture(), original = archived(run);
    let changed: Run = structuredClone(run);
    if (field === 'id') changed.id = 'FIXTURE-OTHER-QUALITY-RUN';
    else if (field === 'schema') changed = { ...structuredClone(fictionalRunV22), id: run.id, versions: { ...run.versions, schema: '2.2.0' } };
    else changed.versions[field] = 'kds_fixture_other_version';
    expect(knownFailedChecks(changed, undefined, original)).toEqual([]);
  });
  it.each<RunReviewState | undefined>([undefined, { status: 'loading' }, { status: 'unavailable' }, { status: 'ready', review: null }])('does not fabricate failures from absent or unavailable review %#', (state) => {
    const run = fixture();
    expect(knownFailedChecks(run, state)).toEqual([]);
    const html = renderToStaticMarkup(createElement(SignalResult, { run, reviewState: state }));
    expect(html).not.toContain('data-quality-hold=');
    expect(html).toContain('処理の終了は、V1〜V5の合格や本人受入を示しません');
    expect(html).not.toContain('品質合格');
  });
  it('keeps an empty failure list separate from acceptance or an invented quality pass', () => {
    const run = fixture(), state: RunReviewState = { status: 'ready', review: review(run, []) };
    expect(knownFailedChecks(run, state)).toEqual([]);
    const html = renderToStaticMarkup(createElement(SignalResult, { run, reviewState: state }));
    expect(html).toContain('登録された未達指摘なし'); expect(html).toContain('本人受入：未実施');
    expect(html).toContain('未記録の項目は合格と判断しません'); expect(html).not.toContain('data-quality-hold=');
  });
  it('does not turn unrelated failed checks into a V2 or V4 hold', () => {
    const run = fixture(), state: RunReviewState = { status: 'ready', review: review(run, ['V1', 'V3', 'V5']) };
    expect(knownFailedChecks(run, state)).toEqual(['V1', 'V3', 'V5']);
    expect(claimFailedChecks(knownFailedChecks(run, state), run.signal!, run.signal!.hypotheses[0].evidenceIds)).toEqual([]);
    expect(renderToStaticMarkup(createElement(SignalResult, { run, reviewState: state }))).not.toContain('data-quality-hold=');
  });
});

describe('holds follow model claims and leave source facts intact', () => {
  it('holds V2-dependent claims, including opposition, without treating every ID as a visual observation', () => {
    const signal = fixture().signal!, observation = signal.visualObservations[0].id;
    expect(claimFailedChecks(['V2'], signal, [observation])).toEqual(['V2']);
    for (const ids of [[], [signal.designFacts[0].id], [signal.officialFacts[0].id], signal.media.map((item) => item.id), ['FIXTURE-UNKNOWN-EVIDENCE']]) {
      expect(claimFailedChecks(['V2'], signal, ids)).toEqual([]);
    }
    expect(claimFailedChecks(['V2', 'V4'], signal, [observation])).toEqual(['V2', 'V4']);
    expect(claimFailedChecks(['V4'], signal, [signal.designFacts[0].id])).toEqual(['V4']);
  });
  it('preserves escaped original text inside an explicit hold, and renders unheld content normally', () => {
    const raw = '架空の原文 <保存値>。';
    const html = renderToStaticMarkup(createElement(SignalQualityHold, { checks: ['V2', 'V4'], label: '架空の保存記述', children: createElement('p', null, raw) }));
    expect(html).toContain('data-quality-hold="V2 V4"'); expect(html).toContain('V2 FAIL / V4 FAIL');
    expect(html).toContain('結論への採用保留'); expect(html).toContain('<summary>架空の保存記述の原文を確認</summary>');
    expect(html).toContain('架空の原文 &lt;保存値&gt;。'); expect(html).not.toContain('<保存値>');
    const unheld = renderToStaticMarkup(createElement(SignalQualityHold, { checks: [], label: '架空の保存記述', children: createElement('p', null, raw) }));
    expect(unheld).not.toContain('data-quality-hold='); expect(unheld).toContain('架空の原文 &lt;保存値&gt;。');
  });
  it('keeps archived holds when the review banner is hidden, preserving raw statements, facts, quotes and unknown dates', () => {
    const run = fixture(), before = JSON.stringify(run), signal = run.signal!;
    const html = renderToStaticMarkup(createElement(SignalResult, { run, showReview: false, archivedQuality: archived(run) }));
    expect(html).toContain('保存資料と品質未達のAI記述'); expect(html).not.toContain('今回わかったこと');
    expect(elementById(html, evidenceId(signal.visualObservations[0].id))).toContain('data-quality-hold="V2"');
    expect(elementById(html, evidenceId(signal.hypotheses[0].id))).toContain('data-quality-hold=');
    expect(elementById(html, evidenceId(signal.hypotheses[1].id))).toContain('data-quality-warning="V4"');
    expect(html).toContain(signal.visualObservations[0].observation);
    expect(html).toContain(signal.hypotheses[0].text); expect(html).toContain(signal.hypotheses[0].limitations[0]);
    const official = elementById(html, 'signal-official'), facts = elementById(html, 'signal-design-facts');
    expect(official).toContain(signal.officialFacts[0].quote); expect(official).toContain('発表日：不明');
    expect(official).not.toContain('data-quality-hold='); expect(facts).not.toContain('data-quality-hold=');
    expect(html).toContain('収録範囲での新規観測0件'); expect(JSON.stringify(run)).toBe(before);
    expect(signal.sources.every((source) => source.publishedAt === null && source.updatedAt === null && source.releaseAt === null)).toBe(true);
  });
  it('removes failed observation prose from the overview while retaining its count and original evidence route', () => {
    const run = fixture(), signal = run.signal!;
    const html = renderToStaticMarkup(createElement(ResultQualityContext.Provider, { value: ['V2'] }, createElement(ResultOverview, { run })));
    expect(html).toContain('保存資料と品質未達のAI記述'); expect(html).toContain('1件');
    expect(html).toContain('href="#signal-images"'); expect(html).not.toContain(signal.visualObservations[0].observation);
  });
  it('does not hold an independent hypothesis or its limits solely because another observation failed V2', () => {
    const run = fixture(), signal = run.signal!;
    const html = renderToStaticMarkup(createElement(SignalResult, { run, archivedQuality: archived(run, ['V2']) }));
    const dependent = elementById(html, evidenceId(signal.hypotheses[0].id));
    const independent = elementById(html, evidenceId(signal.hypotheses[1].id));
    expect(dependent).toContain('data-quality-hold="V2"'); expect(dependent).toContain(signal.hypotheses[0].limitations[0]);
    expect(independent).not.toContain('data-quality-hold='); expect(independent).toContain(signal.hypotheses[1].text);
    expect(independent).toContain(signal.hypotheses[1].limitations[0]);
  });
  it('keeps the V2 warning next to an observation reached through inline evidence', () => {
    const signal = fixture().signal!;
    const html = renderToStaticMarkup(createElement(ResultQualityContext.Provider, { value: ['V2'] },
      createElement(SignalEvidenceDetails, { signal, ids: [signal.visualObservations[0].id] })));
    expect(html).toContain('data-quality-hold="V2"'); expect(html).toContain('V2 FAIL');
    expect(html).toContain('の原文を確認'); expect(html).toContain(signal.visualObservations[0].observation);
    expect(html).toContain('結論への採用保留');
  });
  it('warns about V4 without withholding every individual claim or inventing an observation failure', () => {
    const run = fixture(), signal = run.signal!;
    const html = renderToStaticMarkup(createElement(SignalResult, { run, archivedQuality: archived(run, ['V4']) }));
    expect(elementById(html, evidenceId(signal.visualObservations[0].id))).not.toContain('data-quality-hold=');
    for (const hypothesis of signal.hypotheses) {
      const content = elementById(html, evidenceId(hypothesis.id));
      expect(content).toContain('data-quality-warning="V4"'); expect(content).not.toContain('data-quality-hold=');
      expect(content).toContain(hypothesis.text); expect(content).not.toContain('保存された仮説と限界の原文を確認');
    }
    for (const relationship of signal.relationships) {
      const content = elementById(html, `signal-relation-${encodeURIComponent(relationship.id)}`);
      expect(content).toContain('data-quality-warning="V4"'); expect(content).not.toContain('data-quality-hold=');
      expect(content).toContain(relationship.summary); expect(content).not.toContain('保存された対応評価の原文を確認');
    }
  });
  it('holds a v2.5 saved answer and its limits without rewriting its evidence, next checks or question', () => {
    const run = decodeRun(structuredClone(questionSample));
    if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('Missing fictional v2.5 answer');
    const before = JSON.stringify(run), answer = run.signal.questionAnswer;
    const html = renderToStaticMarkup(createElement(SignalResult, { run, archivedQuality: archived(run) }));
    const card = elementById(html, 'signal-question-answer-title');
    expect(card).toContain(run.input.analysisQuestion.text);
    expect(html).toContain('data-quality-hold="V2 V4"'); expect(html).toContain('図面の読み取りに再確認が必要です。回答の採用は保留です。'); expect(html).toContain('確認状況の詳細'); expect(html).not.toContain('保存された回答と限界の原文を確認');
    expect(html).toContain(answer.text); expect(html).toContain(answer.limitations[0]); expect(html).toContain(answer.nextChecks[0]);
    expect(html).toContain(run.input.analysisQuestion.text); expect(html).toContain(run.signal.officialFacts[0].quote);
    expect(JSON.stringify(run)).toBe(before);
  });
});

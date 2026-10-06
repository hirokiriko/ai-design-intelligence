import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { decodeRun } from './contract';
import { fictionalRun, fictionalRunV2 } from './fixtures';
import { runStatusLabel } from './labels';
import { SignalHistory } from './SignalHistory';
import { SignalResult } from './SignalResult';

describe('saved run assessment failures', () => {
  it.each([
    ['MODEL_ASSESSMENT_RELATIONSHIP_INVALID', 'AI応答の検証失敗（仮説と根拠の対応）'],
    ['MODEL_ASSESSMENT_TEXT_INVALID', 'AI応答の検証失敗（確認事項の説明）'],
  ])('explains %s in result and history without changing saved data', (errorCode, label) => {
    const run = decodeRun({ ...structuredClone(fictionalRunV2), status: 'failed', signal: null, errorCode });
    const saved = JSON.stringify(run);
    const result = renderToStaticMarkup(createElement(SignalResult, { run }));
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run], state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(result).toContain(label);
    expect(history).toContain(label);
    expect(result).not.toContain(errorCode);
    expect(result).not.toContain('判断する資料が不足');
    expect(JSON.stringify(run)).toBe(saved);
  });

  it.each([null, 'MODEL_EVIDENCE_INVALID', 'OLD_FAILURE', '<script>unknown()</script>'])('retains the generic legacy failure for %s', (errorCode) => {
    const run = decodeRun({ ...structuredClone(fictionalRun), status: 'failed', signal: null, errorCode });
    expect(runStatusLabel(run)).toBe('API・AI処理の失敗');
  });

  it('does not relabel a valid insufficient result or a facts-only failure as invalid AI output', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.status = 'insufficient';
    expect(runStatusLabel(decodeRun(run))).toBe('処理終了');
    expect(renderToStaticMarkup(createElement(SignalResult, { run }))).toContain('判断する資料が不足');
    run.status = 'failed';
    run.versions.model = 'facts-only-deterministic';
    run.errorCode = 'OLD_FAILURE';
    run.signal = null;
    expect(runStatusLabel(run)).toBe('確認処理の失敗');
  });
});

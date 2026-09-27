import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { decodeRun } from './contract';
import { fictionalRun, fictionalRunV2 } from './fixtures';
import { fictionalRunV22 } from './fixtures-v22';
import { candidateFailureLabel, runStatusLabel } from './labels';
import { SignalHistory } from './SignalHistory';
import { SignalResult } from './SignalResult';

const failures = [
  ['MODEL_CANDIDATE_SELECTION_EMPTY', '確認する資料が選択されていませんでした。'],
  ['MODEL_CANDIDATE_SELECTION_DUPLICATE', '同じ資料が重複して選択されていました。'],
  ['MODEL_CANDIDATE_OUT_OF_SCOPE', '今回選択できる範囲外の資料が指定されていました。'],
  ['MODEL_CANDIDATE_ALREADY_FETCHED', '取得済みの資料が再び選択されていました。'],
  ['MODEL_CANDIDATE_ALREADY_ATTEMPTED', '取得を試みた資料が再び選択されていました。'],
  ['MODEL_CANDIDATE_SELECTION_LIMIT', '一度に確認できる資料数の上限を超えていました。'],
  ['MODEL_ADDITIONAL_SELECTION_LIMIT', '追加確認で選択できる資料は1件ですが、件数が一致しませんでした。'],
  ['MODEL_ADDITIONAL_MISSING_REQUIRED', '追加確認に必要な引用・日付・対象の対応について、不足理由が指定されていませんでした。'],
  ['MODEL_ACTION_NOT_ALLOWED', '現在の確認段階では実行できない操作が指定されていました。'],
] as const;

describe('saved candidate selection failures', () => {
  it.each(failures)('renders only the fixed explanation for %s and preserves the snapshot', (errorCode, explanation) => {
    for (const status of ['failed', 'partial'] as const) {
      const run = decodeRun({ ...structuredClone(fictionalRunV22), status, errorCode });
      const saved = JSON.stringify(run);
      const result = renderToStaticMarkup(createElement(SignalResult, { run }));
      const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run], state: 'ready', disabled: false, onSelect: () => undefined }));
      expect(result).toContain(explanation);
      expect(result).toContain('停止前に取得・検証した参考資料');
      expect(result).toContain(run.signal!.visualObservations[0].observation);
      expect(result).not.toContain('今回わかったこと');
      expect(result).not.toContain(errorCode);
      expect(history).toContain('資料選択の検証で停止／分析は未完了');
      expect(JSON.stringify(run)).toBe(saved);
    }
  });

  it.each([fictionalRun, fictionalRunV2, fictionalRunV22])('keeps the old generic code unspecified in schema $schemaVersion', (fixture) => {
    const run = decodeRun({ ...structuredClone(fixture), status: 'failed', signal: null, errorCode: 'MODEL_CANDIDATE_NOT_ALLOWED' });
    const saved = JSON.stringify(run);
    expect(candidateFailureLabel(run)).toBe('資料選択の検証で停止しました。詳細条件は記録されていません。');
    const result = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(result).toContain('詳細条件は記録されていません');
    expect(result).not.toContain('再び選択');
    expect(result).not.toContain('停止前に取得・検証した参考資料');
    expect(JSON.stringify(run)).toBe(saved);
  });

  it.each(['MODEL_CANDIDATE_NOT_ALLOWED: private-value', '<script>candidate()</script>', '__proto__', 'toString', null])('does not display or infer arbitrary error content: %s', (errorCode) => {
    const run = decodeRun({ ...structuredClone(fictionalRunV2), status: 'failed', errorCode });
    expect(candidateFailureLabel(run)).toBeNull();
    expect(runStatusLabel(run)).toBe('API・AI処理の失敗');
    if (errorCode) expect(renderToStaticMarkup(createElement(SignalResult, { run }))).not.toContain(errorCode);
  });

  it('does not relabel complete, running, interrupted or facts-only results as selection failures', () => {
    const run = structuredClone(fictionalRunV2);
    run.errorCode = 'MODEL_CANDIDATE_ALREADY_FETCHED';
    for (const status of ['complete', 'running', 'interrupted'] as const) {
      run.status = status;
      expect(candidateFailureLabel(run)).toBeNull();
    }
    run.status = 'failed';
    run.versions.model = 'facts-only-deterministic';
    expect(candidateFailureLabel(run)).toBeNull();
    expect(runStatusLabel(run)).toBe('確認処理の失敗');
  });
});

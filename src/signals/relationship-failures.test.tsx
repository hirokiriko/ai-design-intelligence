import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { decodeRun } from './contract';
import { fictionalRun, fictionalRunV2 } from './fixtures';
import { relationshipFailureLabel, runStatusLabel } from './labels';
import { SignalHistory } from './SignalHistory';
import { SignalResult } from './SignalResult';

const cases = [
  ['SUPPORT_UNKNOWN', '支持に指定された参照先を、検証済みの根拠から確認できませんでした。'],
  ['OPPOSITION_UNKNOWN', '反証に指定された参照先を、検証済みの根拠から確認できませんでした。'],
  ['OVERLAP', '同じ根拠が支持と反証の両方に指定されていました。'],
  ['DIRECT_SUPPORT_MISSING', '直接対応の判定に必要な支持根拠が指定されていませんでした。'],
  ['DIRECT_DESIGN_MISSING', '直接対応の支持根拠に意匠事実が含まれていませんでした。'],
  ['DIRECT_OFFICIAL_MISSING', '直接対応の支持根拠に検証済みの公式事実が含まれていませんでした。'],
  ['DIRECT_CONTRADICTED', '直接対応の判定に、反証または未確認事項が残っていました。'],
  ['CATEGORY_OFFICIAL_MISSING', '商品分野としての関連を支える検証済みの公式事実がありませんでした。'],
  ['MISSING_EVIDENCE_REQUIRED', '対応が未確認の判定に、次に必要な資料の説明がありませんでした。'],
  ['OPPOSITION_REQUIRED', '無関係・矛盾の判定に反証根拠が指定されていませんでした。'],
] as const;

describe('saved relationship failure diagnostics', () => {
  it.each(cases)('displays fixed %s without changing error, usage or validated snapshot', (suffix, detail) => {
    for (const status of ['failed', 'partial'] as const) {
      const errorCode = `MODEL_EVIDENCE_RELATIONSHIP_${suffix}`;
      const run = decodeRun({ ...structuredClone(fictionalRunV2), status, errorCode,
        usage: { modelRequests: 3, toolCalls: 2, inputTokens: 741, outputTokens: 91 } });
      const before = JSON.stringify(run);
      const html = renderToStaticMarkup(createElement(SignalResult, { run }));
      const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run], state: 'ready', disabled: false, onSelect: () => undefined }));
      expect(html).toContain(detail);
      expect(html).toContain('停止前に取得・検証した参考資料');
      expect(html).toContain('<dt>AI呼出 / 確認処理</dt><dd>3 / 2</dd>');
      expect(html).toContain('<dt>入力 / 出力トークン</dt><dd>741 / 91</dd>');
      expect(html).not.toContain(errorCode);
      expect(history).toContain('根拠対応の検証で停止／分析は未完了');
      expect(JSON.stringify(run)).toBe(before);
    }
  });

  it('preserves old generic failures as detail unrecorded without inventing intermediate facts', () => {
    for (const fixture of [fictionalRun, fictionalRunV2]) {
      const run = decodeRun({ ...structuredClone(fixture), status: 'failed', signal: null,
        errorCode: 'MODEL_EVIDENCE_RELATIONSHIP_INVALID' });
      const before = JSON.stringify(run);
      const html = renderToStaticMarkup(createElement(SignalResult, { run }));
      expect(html).toContain('根拠対応の検証で停止しました。詳細条件は記録されていません。');
      expect(html).not.toContain('停止前に取得・検証した参考資料');
      expect(html).not.toContain('直接対応の支持根拠');
      expect(JSON.stringify(run)).toBe(before);
    }
  });

  it.each(['__proto__', 'constructor', 'toString', '<script>private-id</script>', 'MODEL_EVIDENCE_RELATIONSHIP_UNKNOWN'])('does not infer or echo unknown detail %s', (errorCode) => {
    const run = decodeRun({ ...structuredClone(fictionalRunV2), status: 'failed', errorCode });
    expect(relationshipFailureLabel(run)).toBeNull();
    expect(runStatusLabel(run)).toBe('API・AI処理の失敗');
    expect(renderToStaticMarkup(createElement(SignalResult, { run }))).not.toContain(errorCode);
  });

  it('keeps complete and facts-only outcomes distinct from relationship validation failures', () => {
    const run = structuredClone(fictionalRunV2);
    run.errorCode = 'MODEL_EVIDENCE_RELATIONSHIP_OVERLAP';
    expect(relationshipFailureLabel(run)).toBeNull();
    expect(runStatusLabel(run)).toBe('処理終了');
    run.status = 'failed';
    run.versions.model = 'facts-only-deterministic';
    expect(relationshipFailureLabel(run)).toBeNull();
    expect(runStatusLabel(run)).toBe('確認処理の失敗');
  });
});

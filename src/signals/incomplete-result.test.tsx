import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContractError, decodeRun, decodeRuns, type Run, type RunV23 } from './contract';
import { fictionalRun, fictionalRunV2 } from './fixtures';
import { fictionalRunV22 } from './fixtures-v22';
import reconstruction from './backend-run-v2.1.fixture.json';
import { evidenceId, quoteFailureLabel, runStatusLabel } from './labels';
import { SignalHistory } from './SignalHistory';
import { SignalResult } from './SignalResult';

const quoteFailures = [
  ['MODEL_EVIDENCE_QUOTE_INVALID', '引用検証の詳細条件は記録されていません。'],
  ['MODEL_EVIDENCE_QUOTE_DUPLICATE_SOURCE', '同じ資料への複数の引用が含まれていました。'],
  ['MODEL_EVIDENCE_QUOTE_TOO_LONG', '引用が保存可能な文字数の上限を超えていました。'],
  ['MODEL_EVIDENCE_QUOTE_NOT_FOUND', '引用と完全に一致する箇所を原文で確認できませんでした。'],
  ['MODEL_EVIDENCE_QUOTE_AMBIGUOUS', '引用と一致する箇所が複数あり、位置を特定できませんでした。'],
  ['MODEL_EVIDENCE_QUOTE_OUTSIDE_EXCERPT', '引用がAIに渡した抜粋の範囲外でした。'],
  ['MODEL_EVIDENCE_QUOTE_POSITION_MISMATCH', '引用と保存する文字位置が一致しませんでした。'],
] as const;
const currentRun: RunV23 = { ...fictionalRunV22, schemaVersion: '2.3.0', versions: { ...fictionalRunV22.versions, schema: '2.3.0' } };
const versions = [fictionalRun, fictionalRunV2, decodeRun(reconstruction), fictionalRunV22, currentRun];
const render = (run: Run) => renderToStaticMarkup(createElement(SignalResult, { run }));

describe('saved incomplete results in existing nullable run contracts', () => {
  it.each(versions)('keeps failed and partial snapshots in schema $schemaVersion without changing status, error or usage', (fixture) => {
    for (const status of ['failed', 'partial'] as const) {
      const run = structuredClone(fixture);
      run.status = status;
      run.errorCode = 'MODEL_EVIDENCE_QUOTE_NOT_FOUND';
      run.usage = { modelRequests: 3, toolCalls: 1, inputTokens: 741, outputTokens: 91 };
      const saved = JSON.stringify(run);
      expect(decodeRun(run)).toEqual(run);
      expect(decodeRuns({ schemaVersion: '2.3.0', runs: [run] })).toEqual([run]);
      const html = render(run);
      expect(html).toContain('引用の検証で停止／分析は未完了');
      expect(html).toContain('停止前に取得・検証した参考資料');
      expect(html).toContain('検証済みは内容の正しさを人が確認した意味ではありません');
      expect(html).toContain('関連仮説 · 中間候補');
      expect(html).toContain('<dt>AI呼出 / 確認処理</dt><dd>3 / 1</dd>');
      expect(html).toContain('<dt>入力 / 出力トークン</dt><dd>741 / 91</dd>');
      expect(html.match(/role="alert"/g)).toHaveLength(1);
      for (const completed of ['今回わかったこと', '判断する資料が不足', '保存された総合判定', '<h3>検討材料と未確認事項</h3>']) expect(html).not.toContain(completed);
      expect(html).toContain(`/api/v1/media/${run.signal!.media[0].id}`);
      expect(html).toContain(`href="#${evidenceId(run.signal!.media[0].id)}"`);
      expect(JSON.stringify(run)).toBe(saved);
    }
  });

  it.each(quoteFailures)('distinguishes the safe %s diagnosis in saved results and history', (errorCode, message) => {
    const run = decodeRun({ ...structuredClone(fictionalRunV2), status: 'failed', errorCode });
    expect(render(run)).toContain(message);
    expect(render(run)).not.toContain(errorCode);
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run], state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(history).toContain('引用の検証で停止／分析は未完了');
  });

  it('keeps old null failures empty and does not invent a precise cause', () => {
    const run = decodeRun({ ...structuredClone(currentRun), status: 'failed', signal: null, errorCode: 'MODEL_EVIDENCE_QUOTE_INVALID' });
    const html = render(run);
    expect(html).toContain('引用検証の詳細条件は記録されていません');
    expect(html).not.toContain('停止前に取得・検証した参考資料');
    expect(html).not.toContain('関連仮説 · 中間候補');
    expect(html).not.toContain('/api/v1/media/');
    expect(run.signal).toBeNull();
  });

  it.each(['UNKNOWN_FAILURE', '<script>unverified🙂</script>', '__proto__', 'toString', null])('does not leak or infer unknown failure detail: %s', (errorCode) => {
    const run = decodeRun({ ...structuredClone(fictionalRunV2), status: 'failed', errorCode });
    expect(quoteFailureLabel(run)).toBeNull();
    expect(runStatusLabel(run)).toBe('API・AI処理の失敗');
    if (errorCode) expect(render(run)).not.toContain(errorCode);
    expect(render(run)).not.toContain('今回わかったこと');
  });

  it('retains verified observations, quotes and counterevidence as intermediate references', () => {
    const run = structuredClone(fictionalRunV2);
    run.status = 'partial';
    run.errorCode = 'MODEL_EVIDENCE_QUOTE_AMBIGUOUS';
    run.signal!.status = 'insufficient';
    run.signal!.relationships[0].relation = 'unknown';
    run.signal!.relationships[0].supportingEvidenceIds = ['observation-1'];
    run.signal!.relationships[0].opposingEvidenceIds = ['official-1'];
    const saved = JSON.stringify(run);
    const html = render(decodeRun(run));
    for (const fact of [...run.signal!.designFacts, ...run.signal!.officialFacts, ...run.signal!.hypotheses]) expect(html).toContain(fact.text);
    expect(html).toContain(run.signal!.visualObservations[0].observation);
    expect(html).toContain(run.signal!.officialFacts[0].quote);
    expect(html).toContain('不一致・反証の根拠');
    expect(html).toContain(`href="#${evidenceId('official-1')}"`);
    expect(html).toContain('中間候補 · 対応不明');
    expect(html).not.toContain('資料不足・対応不明');
    expect(JSON.stringify(run)).toBe(saved);
  });

  it('retains reference validation on failed snapshots and rejects invalid source, media and Unicode quote positions', () => {
    const run = structuredClone(fictionalRunV2);
    run.status = 'failed';
    run.errorCode = 'MODEL_EVIDENCE_QUOTE_POSITION_MISMATCH';
    const source = run.signal!.sources[0];
    source.excerpt = '前文🙂\n操作部を変更しました。';
    source.modelVisibleChars = Array.from(source.excerpt).length;
    source.extractedChars = source.modelVisibleChars;
    const fact = run.signal!.officialFacts[0];
    fact.start = 4;
    fact.end = 15;
    expect(decodeRun(run)).toEqual(run);
    const badPosition = structuredClone(run);
    badPosition.signal!.officialFacts[0].start = 5;
    expect(() => decodeRun(badPosition)).toThrow(ContractError);
    const badSource = structuredClone(run);
    badSource.signal!.officialFacts[0].sourceId = 'unverified-source';
    expect(() => decodeRun(badSource)).toThrow(ContractError);
    const badMedia = structuredClone(run);
    badMedia.signal!.visualObservations[0].mediaIds[0] = 'unverified-media';
    expect(() => decodeRun(badMedia)).toThrow(ContractError);
    const badQuote = structuredClone(run);
    badQuote.signal!.officialFacts[0].quote = '未検証の引用';
    expect(() => decodeRun(badQuote)).toThrow(ContractError);
  });

  it.each(['failed', 'partial', 'interrupted', 'running'] as const)('does not promote %s snapshots to ordinary conclusions', (status) => {
    const run = structuredClone(fictionalRunV2);
    run.status = status;
    if (status === 'running') run.completedAt = null;
    const html = render(decodeRun(run));
    expect(html).toContain('停止前に取得・検証した参考資料');
    expect(html).not.toContain('今回わかったこと');
    expect(html).not.toContain('保存された総合判定');
  });

  it.each(['change_detected', 'insufficient'] as const)('preserves a completed %s result and its existing conclusion', (status) => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.status = status;
    const html = render(decodeRun(run));
    expect(html).toContain('今回わかったこと');
    expect(html).toContain('保存された総合判定');
    expect(html).not.toContain('停止前に取得・検証した参考資料');
    expect(html).not.toContain('関連仮説 · 中間候補');
    if (status === 'insufficient') expect(html).toContain('判断する資料が不足');
  });
});

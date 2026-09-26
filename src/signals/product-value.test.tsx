import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContractError, decodeBootstrap, decodeRun, decodeRuns } from './contract';
import { fictionalBootstrapV2, fictionalRun, fictionalRunV2 } from './fixtures';
import { fictionalRunV22 } from './fixtures-v22';
import { comparisonPairsVersion, evidenceId, savedResultTarget } from './labels';
import { SignalResult } from './SignalResult';
import { AnalysisModeNotice } from './SignalWorkspace';

describe('product questions and saved evidence', () => {
  it('uses an exact saved article name for a code-only category and preserves the original classification in details', () => {
    const run = structuredClone(fictionalRunV2);
    run.input.context.category.label = 'EXAMPLE-99';
    run.signal!.recordFacts[0].classifications[0].code = 'EXAMPLE-99';
    const before = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('id="signal-result-heading">架空リーフ機器株式会社 / 対象物品：架空操作機器</h2>');
    expect(html).toContain('<h3>架空リーフ機器株式会社 / EXAMPLE-99</h3>');
    expect(html).toContain('<dt>企業 / 分類</dt><dd>架空リーフ機器株式会社 / EXAMPLE-99</dd>');
    expect(JSON.stringify(run)).toBe(before);
  });

  it('lists distinct saved article names instead of inventing a product group', () => {
    const run = structuredClone(fictionalRunV2);
    run.input.context.category.label = 'EXAMPLE-99';
    const first = run.signal!.recordFacts[0];
    first.classifications[0].code = 'EXAMPLE-99';
    run.signal!.recordFacts.push({ ...first, id: 'fact-other', recordId: 'record-other', articleName: '架空調整機器' });
    run.signal!.recordFacts.push({ ...first, id: 'fact-repeat', recordId: 'record-repeat' });
    expect(savedResultTarget(run)).toBe('架空リーフ機器株式会社 / 対象物品：架空操作機器・架空調整機器');
  });

  it('keeps descriptive categories, unknown article names, unmatched labels, and legacy saved targets unchanged', () => {
    expect(savedResultTarget(fictionalRunV2)).toBe('架空リーフ機器株式会社 / 操作機器 / H1');
    expect(savedResultTarget(fictionalRun)).toBe(fictionalRun.input.watch.name);
    const run = structuredClone(fictionalRunV2);
    run.input.context.category.label = 'EXAMPLE-99';
    expect(savedResultTarget(run)).toBe('架空リーフ機器株式会社 / EXAMPLE-99');
    run.signal!.recordFacts[0].classifications[0].code = 'EXAMPLE-99';
    run.signal!.recordFacts[0].articleName = null;
    expect(savedResultTarget(run)).toBe('架空リーフ機器株式会社 / EXAMPLE-99');
    run.signal = null;
    expect(savedResultTarget(run)).toBe('架空リーフ機器株式会社 / EXAMPLE-99');
  });

  it('leads with the saved target and findings, then images, official facts, and next checks before processing details', () => {
    const run = structuredClone(fictionalRunV22);
    const before = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    const ordered = ['id="signal-result-heading"', '今回わかったこと', 'id="signal-images"', 'id="signal-official"', '検討材料と未確認事項', '<summary>収録条件と保存対象の詳細</summary>', '<summary>保存条件・実行情報</summary>'];
    for (let index = 1; index < ordered.length; index++) {
      expect(html.indexOf(ordered[index])).toBeGreaterThan(html.indexOf(ordered[index - 1]));
    }
    expect(html).toContain('<details class="signal-details" data-print-evidence="true"><summary>収録条件と保存対象の詳細</summary>');
    expect(html).toContain('<details class="signal-details" data-print-evidence="true"><summary>保存条件・実行情報</summary>');
    expect(html).toContain('収録件数の差は、形状の変化や商品の世代差を示しません');
    expect(JSON.stringify(run)).toBe(before);
  });

  it('links a newly observed design to its saved fact without adding an assessment', () => {
    const html = renderToStaticMarkup(createElement(SignalResult, { run: fictionalRunV2 }));
    expect(html).toContain('詳しく見る意匠');
    expect(html).toContain(`href="#${evidenceId('fact-1')}">架空操作機器（登録番号 FIXTURE-REG-EXAMPLE）</a>`);
    expect(html).toContain(`id="${evidenceId('fact-1')}"`);
  });

  it('keeps official facts visible when an individual product relationship is unknown', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.relationships[0].relation = 'unknown';
    run.signal!.hypotheses = [];
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain(run.signal!.officialFacts[0].text);
    expect(html).toContain(run.signal!.visualObservations[0].observation);
    expect(html).toContain('資料不足・対応不明');
    expect(html).toContain(run.signal!.questionsForHuman[0]);
  });

  it('keeps a concise hypothesis visible and preserves every caveat in counted printable disclosures', () => {
    const run = structuredClone(fictionalRunV2);
    const before = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    const hypothesis = run.signal!.hypotheses[0];
    expect(html).toContain('関連仮説 · 未確認');
    expect(html.indexOf(hypothesis.text)).toBeLessThan(html.indexOf('<summary>この仮説の限界'));
    expect(html).toContain('<details class="signal-details" data-print-evidence="true"><summary>この仮説の限界（1件）</summary>');
    expect(html).toContain('<details class="signal-details" data-print-evidence="true"><summary>個別意匠と商品の対応（1件）</summary>');
    expect(html).toContain('<details class="signal-details" data-print-evidence="true"><summary>次に確認する資料・未確認事項（2件）</summary><div id="signal-next-checks"');
    for (const saved of [...hypothesis.limitations, ...run.signal!.questionsForHuman, ...run.signal!.limitations, ...run.signal!.relationships[0].missingEvidence, run.signal!.relationships[0].summary]) expect(html).toContain(saved);
    expect(html).toContain(`href="#${evidenceId(hypothesis.evidenceIds[0])}"`);
    expect(html).not.toContain('data-print-evidence="true" open=');
    expect(JSON.stringify(run)).toBe(before);
  });

  it.each([['unknown', '判断不能'], ['no_change', '変化は見られない']] as const)('only displays explicit image assessment %s', (status, label) => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.visualObservations[0].status = status;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain(`<strong>操作部</strong> · ${label}`);
  });

  it('does not guess why an old saved result has no image observations', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.visualObservations = [];
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('保存情報だけでは、未実施・取得失敗・判断不能を特定できません');
    expect(html).not.toContain('変化は見られない');
  });
});

describe('bootstrap 2.4 analysis mode', () => {
  it.each(['facts_only', 'standard'] as const)('uses the explicit %s capability before starting a run', (analysisMode) => {
    const bootstrap = decodeBootstrap({ ...fictionalBootstrapV2, schemaVersion: '2.4.0', analysisMode, dataMode: analysisMode === 'facts_only' ? 'approved_public' : 'fictional' });
    const html = renderToStaticMarkup(createElement(AnalysisModeNotice, { bootstrap }));
    expect(html).toContain(analysisMode === 'facts_only' ? '書誌情報のみの比較' : '登録資料を使う分析');
    expect(html).toContain(analysisMode === 'facts_only' ? '画像/記事分析は未実施となります' : '今回の入力で実施できた内容は保存結果に示します');
    expect(comparisonPairsVersion(bootstrap.schemaVersion)).toBe('2.3.0');
  });

  it('leaves old bootstrap mode unknown and retains separate pair and run versions', () => {
    const bootstrap = decodeBootstrap(fictionalBootstrapV2);
    expect(renderToStaticMarkup(createElement(AnalysisModeNotice, { bootstrap }))).toContain('分析モードは未記録');
    expect(bootstrap.analysisMode).toBeUndefined();
    expect(comparisonPairsVersion('2.2.0')).toBe('2.2.0');
    expect(comparisonPairsVersion('2.3.0')).toBe('2.3.0');
    expect(comparisonPairsVersion('2.1.0')).toBeNull();
    expect(() => decodeRun({ ...fictionalRunV2, schemaVersion: '2.4.0' })).toThrow(ContractError);
    expect(() => decodeRuns({ schemaVersion: '2.4.0', runs: [fictionalRunV2] })).toThrow(ContractError);
  });

  it('rejects missing or unknown modes and mode fields silently added to old bootstrap', () => {
    const current = { ...fictionalBootstrapV2, schemaVersion: '2.4.0' };
    expect(() => decodeBootstrap(current)).toThrow(ContractError);
    expect(() => decodeBootstrap({ ...current, analysisMode: 'automatic' })).toThrow(ContractError);
    expect(() => decodeBootstrap({ ...current, analysisMode: 'facts_only', dataMode: 'fictional' })).toThrow(ContractError);
    expect(() => decodeBootstrap({ ...fictionalBootstrapV2, analysisMode: 'facts_only' })).toThrow(ContractError);
  });
});

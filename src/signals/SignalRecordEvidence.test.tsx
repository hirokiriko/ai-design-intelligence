import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fictionalRun, fictionalRunV2 } from './fixtures';
import { fictionalRunV22 } from './fixtures-v22';
import { evidenceId } from './labels';
import { SignalResult } from './SignalResult';
import { RecordEvidenceDetails, SignalRecordEvidence } from './SignalRecordEvidence';

describe('human-readable design evidence', () => {
  const watch = { ...fictionalRunV2.input.watch, beforeDatasetId: 'internal-before-v1', afterDatasetId: 'internal-after-v1' };
  const record = {
    articleName: '架空の操作器', applicants: [], gazetteDate: '2026-07-01', applicationDate: '2026-06-01',
    registrationNumber: 'FIXTURE-REG-01', applicationNumber: 'FIXTURE-APP-01',
    classifications: [
      { scheme: 'JPO_NATIONAL_DESIGN', code: 'B7-FIXTURE', label: null, isPrimary: true },
      { scheme: 'JPO_D_TERM', code: 'D-FIXTURE', label: null, isPrimary: false },
      { scheme: 'LOCARNO', code: '09-FIXTURE', label: null, isPrimary: false },
    ],
    description: '架空資料の説明', articleDescription: null,
    adapterDisposition: { status: 'accepted' as const, exclusionReasons: [] },
  };

  it('shows a public identity in the disclosure button while retaining its lookup key internally', () => {
    const run = structuredClone(fictionalRun);
    run.input.watch = watch;
    const html = renderToStaticMarkup(createElement(SignalRecordEvidence, { recordId: 'internal-record-v1', run, label: '架空の操作器（登録番号 FIXTURE-REG-01）' }));
    expect(html).toContain('根拠意匠：架空の操作器（登録番号 FIXTURE-REG-01） を確認');
    expect(html).not.toContain('internal-record-v1');
  });

  it.each([fictionalRunV2, fictionalRunV22])('links modern saved evidence to the same run without an acquisition control ($schemaVersion)', (run) => {
    const before = JSON.stringify(run);
    const fact = run.signal!.recordFacts[0];
    const html = renderToStaticMarkup(createElement(SignalRecordEvidence, { recordId: fact.recordId, run, label: '架空操作機器' }));
    expect(html).toContain(`href="#${evidenceId(fact.id)}"`);
    expect(html).toContain('保存された根拠意匠：架空操作機器 を表示');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('aria-expanded');
    expect(JSON.stringify(run)).toBe(before);
  });

  it('leaves missing modern record details unavailable without offering a current-dataset fallback', () => {
    const html = renderToStaticMarkup(createElement(SignalRecordEvidence, { recordId: 'missing-record', run: fictionalRunV2, label: '架空の比較A資料' }));
    expect(html).toContain('この実行に根拠意匠の詳細は保存されていません');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('href=');
  });

  it('renders saved facts once and points media to their existing fragment', () => {
    const html = renderToStaticMarkup(createElement(SignalResult, { run: fictionalRunV2 }));
    expect(html.match(/<dt>物品の説明<\/dt>/g)).toHaveLength(1);
    expect(html.match(/保存された根拠意匠：架空操作機器/g)).toHaveLength(1);
    expect(html).toContain(`id="${evidenceId('fact-1')}"`);
    expect(html).toContain('元の収録データの再取得・再検証は行いません');
    expect(html).not.toContain('class="signal-record-evidence"');
  });

  it('shows comparison sides, public numbers and classification codes without dataset IDs or raw schemes', () => {
    const html = renderToStaticMarkup(createElement(RecordEvidenceDetails, { watch, entries: [
      { datasetId: watch.beforeDatasetId, record },
      { datasetId: watch.afterDatasetId, record: { ...record, adapterDisposition: { status: 'excluded' as const, exclusionReasons: [] } } },
    ] }));
    expect(html).toContain('<dt>分析対象</dt><dd>対象 · 比較A</dd>');
    expect(html).toContain('<dt>分析対象</dt><dd>除外 · 比較B</dd>');
    expect(html).toContain('登録番号 / 出願番号</dt><dd>FIXTURE-REG-01 / FIXTURE-APP-01');
    for (const label of ['日本意匠分類 B7-FIXTURE', 'Dターム D-FIXTURE', 'ロカルノ分類 09-FIXTURE']) expect(html).toContain(label);
    for (const internal of ['internal-before-v1', 'internal-after-v1', 'JPO_NATIONAL_DESIGN', 'JPO_D_TERM', 'LOCARNO']) expect(html).not.toContain(internal);
  });
});

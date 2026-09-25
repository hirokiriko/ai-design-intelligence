import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fictionalRunV2 } from './fixtures';
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
    const html = renderToStaticMarkup(createElement(SignalRecordEvidence, { recordId: 'internal-record-v1', watch, label: '架空の操作器（登録番号 FIXTURE-REG-01）' }));
    expect(html).toContain('根拠意匠：架空の操作器（登録番号 FIXTURE-REG-01） を確認');
    expect(html).not.toContain('internal-record-v1');
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

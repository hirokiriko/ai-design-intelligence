import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fictionalRunV22 } from './fixtures-v22';
import type { RunV23 } from './contract';
import { SignalComparisonGate } from './SignalComparisonGate';

const run: RunV23 = { ...fictionalRunV22, schemaVersion: '2.3.0', versions: { ...fictionalRunV22.versions, schema: '2.3.0' } };
const before = run.input.context.beforeDataset.id, after = run.input.context.afterDataset.id;
const marker = 'kds_fixture_SAVED_COMPARISON';
const view = (params: Record<string, string>) => {
  vi.stubGlobal('window', { location: { search: new URLSearchParams(params).toString() } });
  return renderToStaticMarkup(createElement(SignalComparisonGate, { run, children: marker }));
};
afterEach(() => vi.unstubAllGlobals());

describe('exact saved comparison selection', () => {
  it('uses the registered preset only for the default or the exact saved pair', () => {
    expect(view({})).toContain(marker);
    expect(view({ comparisonBefore: before, comparisonAfter: after })).toContain(marker);
  });
  it.each([
    { comparisonBefore: before },
    { comparisonAfter: after },
    { comparisonBefore: '', comparisonAfter: after },
    { comparisonBefore: before, comparisonAfter: 'FIXTURE-UNKNOWN-DATASET' },
  ] as Record<string, string>[])('does not substitute a different comparison for an unresolved explicit URL: %j', (params) => {
    const html = view(params);
    expect(html).not.toContain(marker); expect(html).toContain('指定された収録集合を確認できません');
    expect(html).toContain('登録済みの比較条件に戻す');
  });
  it('does not reuse the saved result in reverse order or for the same dataset', () => {
    let html = view({ comparisonBefore: after, comparisonAfter: before });
    expect(html).not.toContain(marker); expect(html).toContain('この組み合わせに一致する保存結果はありません');
    html = view({ comparisonBefore: before, comparisonAfter: before });
    expect(html).not.toContain(marker); expect(html).toContain('同じ収録集合が選ばれています');
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fictionalRunV22 } from './fixtures-v22';
import type { RunV23 } from './contract';
import { SignalScopeEvidence, SignalScopeSummary, SignalSelectedRecord } from './SignalScopeSummary';
import { evidenceId } from './labels';

function fixture(): RunV23 {
  const run = structuredClone(fictionalRunV22);
  return { ...run, schemaVersion: '2.3.0', versions: { ...run.versions, schema: '2.3.0' } };
}

describe('saved company and category scope', () => {
  it('keeps a comparable zero distinct from product changes and names the saved classification, not its identifier', () => {
    const run = fixture();
    run.input.context.category = { id: 'kds_fixture_OPAQUE_CATEGORY', label: '架空の分類表示', scheme: null };
    run.signal!.counts = { before: 7, after: 7, newlyObserved: 0, excludedBefore: 1, excludedAfter: 3, comparable: true };
    run.signal!.recordFacts[0].articleName = null;
    const before = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(SignalScopeSummary, { run }));
    expect(html).toContain('架空の分類表示'); expect(html).not.toContain('kds_fixture_OPAQUE_CATEGORY');
    expect(html).toContain('物品名不明'); expect(html).toContain('<strong>0<small>件</small></strong>');
    expect(html).toContain('形状や商品が変わっていないとは判断できません');
    expect(html).toContain(run.input.context.beforeDataset.dataAsOf); expect(html).toContain(run.input.context.afterDataset.dataAsOf);
    expect(html).toContain('両集合に収録（算出）'); expect(html).toContain('この範囲での新規観測は0件'); expect(JSON.stringify(run)).toBe(before);
  });
  it('does not report the backend placeholder zero as a measured result when scope is incomparable', () => {
    const run = fixture(); run.signal!.counts.comparable = false; run.signal!.counts.newlyObserved = 0;
    const html = renderToStaticMarkup(createElement(SignalScopeSummary, { run }));
    expect(html).toContain('新規観測は比較できません'); expect(html).toContain('比較不可');
    expect(html).not.toContain('<strong>0<small>件</small></strong>'); expect(html).not.toContain('この範囲での新規観測は0件');
  });
  it('does not fill an absent saved signal with zeros', () => {
    const run = fixture(); run.signal = null;
    expect(renderToStaticMarkup(createElement(SignalScopeSummary, { run }))).toBe('');
    expect(renderToStaticMarkup(createElement(SignalScopeEvidence, { run }))).toBe('');
  });
  it('connects selected record facts only to their saved images and exposes missing media and collection provenance', () => {
    const run = fixture(); const signal = run.signal!;
    const sample = structuredClone(signal.recordFacts[0]);
    sample.id = 'kds_fixture_SCOPE_ONLY_FACT'; sample.recordId = 'FIXTURE-SCOPE-ONLY'; sample.selectionReason = 'scope_sample';
    sample.gazetteDate = null; sample.registrationNumber = null; signal.recordFacts.push(sample);
    const before = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(SignalScopeEvidence, { run }));
    expect(html).toContain('対象全件の一覧とは限りません'); expect(html).toContain('書誌事項のみ · 保存図面なし');
    expect(html).toContain('対象範囲から選ばれた参考資料'); expect(html).toContain('登録 不明');
    expect(html).toContain('保存された2つの収録集合'); expect(html).toContain('理由別の件数はこの結果には保存されていません');
    expect(html).toContain('保存時の対象とデータ');
    for (const media of signal.media) {
      const selected = renderToStaticMarkup(createElement(SignalSelectedRecord, { signal, recordId: media.recordId }));
      expect(selected).toContain(`href="#${evidenceId(media.id)}"`);
      for (const other of signal.media.filter((item) => item.recordId !== media.recordId)) expect(selected).not.toContain(`href="#${evidenceId(other.id)}"`);
    }
    const withoutMedia = renderToStaticMarkup(createElement(SignalSelectedRecord, { signal, recordId: sample.recordId }));
    expect(withoutMedia).toContain('この結果に図面は保存されていません'); expect(withoutMedia).not.toContain('href=');
    for (const fact of signal.recordFacts) expect(html).toContain(`id="${evidenceId(fact.id)}"`);
    expect(JSON.stringify(run)).toBe(before);
  });
  it('does not derive a negative or oversized intersection from inconsistent saved counts', () => {
    const run = fixture(); run.signal!.counts = { before: 2, after: 3, newlyObserved: 0, excludedBefore: 0, excludedAfter: 0, comparable: true };
    let html = renderToStaticMarkup(createElement(SignalScopeSummary, { run })); expect(html).toContain('算出不可');
    run.signal!.counts.newlyObserved = 4;
    html = renderToStaticMarkup(createElement(SignalScopeSummary, { run })); expect(html).toContain('算出不可'); expect(html).not.toContain('<strong>-1');
  });
});

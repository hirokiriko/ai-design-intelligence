import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { decodeRun } from './contract';
import fixture from './backend-run-v2.5.fixture.json';
import { SignalSavedEntry } from './SignalSavedEntry';
import { sourceDisplayTitle, explanationDisplayText } from './source-display';

function saved() {
  const run = decodeRun(structuredClone(fixture));
  if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('Missing fictional saved run');
  return { run, signal: run.signal };
}
describe('saved-material entry', () => {
  it('separates unchanged target counts from changing total input and leaves the saved DTO intact', () => {
    const { run, signal } = saved();
    signal.counts = { ...signal.counts, before: 4, after: 4, newlyObserved: 0, excludedBefore: 2, excludedAfter: 5, comparable: true };
    const before = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(SignalSavedEntry, { run }));
    expect(html).toContain('対象意匠 <b>4</b> → <b>4</b>件');
    expect(html).toContain('入力収録 6 → 9件');
    expect(html).toContain('この範囲での新規観測は0件');
    expect(html).toContain(run.input.context.beforeDataset.dataAsOf);
    expect(html).toContain(run.input.context.afterDataset.dataAsOf);
    expect(html).toContain('比較Aの収録'); expect(html).not.toContain('前回の結果');
    expect(JSON.stringify(run)).toBe(before);
  });
  it('shows only the saved comparison pair, exact source excerpts and working details links', () => {
    const { run, signal } = saved();
    signal.media.push({ ...signal.media[0], id: 'kds_fixture_unselected_media' });
    signal.sources[0].title = 'FIXTURE 商品<br>説明 &amp; 資料';
    const before = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(SignalSavedEntry, { run }));
    expect(html).not.toContain('kds_fixture_unselected_media');
    expect(html).toContain('FIXTURE 商品 説明 &amp; 資料');
    expect(html).not.toContain('&lt;br&gt;');
    expect(html).toContain('href="#signal-images"'); expect(html).toContain('href="#signal-next-checks"');
    expect(html).toContain('href="#signal-history"');
    expect(html.match(/signal-entry-primary/g)).toHaveLength(1);
    expect(JSON.stringify(run)).toBe(before);
  });
  it('does not create evidence controls for absent materials or claim a comparable increase', () => {
    const { run, signal } = saved();
    signal.media = []; signal.sources = []; signal.counts.comparable = false;
    const html = renderToStaticMarkup(createElement(SignalSavedEntry, { run }));
    expect(html).toContain('比較不可'); expect(html).not.toContain('signal-entry-primary');
    expect(html).not.toContain('/api/v1/media/'); expect(html).not.toContain('照合する公式資料の商品説明');
  });
  it('renders markup-like titles only as plain display text', () => {
    expect(sourceDisplayTitle('FIXTURE<br/>甲 <b>乙</b> &amp; 丙')).toBe('FIXTURE 甲 乙 & 丙');
    expect(sourceDisplayTitle('<br>')).toBe('タイトル不明');
    expect(explanationDisplayText('FIXTURE 資料<br>甲：次に確認')).toBe('FIXTURE 資料 甲：次に確認');
    expect(explanationDisplayText('値 < 5 > 1')).toBe('値 < 5 > 1');
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignalDrawingComparison } from './SignalDrawingComparison';
import { SignalResult } from './SignalResult';
import { fictionalRun } from './fixtures';
import { fictionalRunV22 } from './fixtures-v22';

describe('saved drawing comparison', () => {
  const media = fictionalRun.signal!.media;
  it('keeps the comparison closed and avoids a second image load before the user opens it', () => {
    let urlsRequested = 0;
    const html = renderToStaticMarkup(createElement(SignalDrawingComparison, { media, mediaUrl: () => { urlsRequested += 1; return '/FIXTURE-image'; } }));
    expect(html).toContain('比較A・Bの図面を並べて拡大');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('<dialog');
    expect(html).not.toContain('<img');
    expect(urlsRequested).toBe(0);
  });
  it('does not invent a comparison from missing, duplicated or ambiguous drawings', () => {
    for (const invalid of [[], [media[0]], [media[0], { ...media[1], id: media[0].id }], [media[0], { ...media[1], role: 'comparisonA' as const }], [...media, { ...media[0], id: 'FIXTURE-extra-media' }]]) {
      expect(renderToStaticMarkup(createElement(SignalDrawingComparison, { media: invalid }))).toBe('');
    }
  });
  it('only enables saved focus points whose references belong to the selected drawings', () => {
    const focusPoints = [
      { id: 'FIXTURE-focus-one', text: '架空図面の内側の線を確認する。機能は不明。', mediaIds: [media[0].id] },
      { id: 'FIXTURE-focus-missing', text: '参照先が不明な架空の観察。', mediaIds: [] },
      { id: 'FIXTURE-focus-outside', text: '選択外の架空図面への参照。', mediaIds: ['FIXTURE-not-in-selected-pair'] },
    ];
    const original = JSON.stringify({ media, focusPoints });
    const html = renderToStaticMarkup(createElement(SignalDrawingComparison, { media, focusPoints }));
    const buttons = html.match(/<button[^>]*class="signal-drawing-focus-card"[^>]*>[\s\S]*?<\/button>/g)!;
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).not.toContain('disabled');
    expect(buttons.slice(1).every((button) => button.includes('disabled') && button.includes('参照図面を確認できません'))).toBe(true);
    expect(html).not.toContain('<img');
    expect(JSON.stringify({ media, focusPoints })).toBe(original);
  });
  it('uses the saved selected comparison when the result also contains other drawings', () => {
    const run = structuredClone(fictionalRunV22);
    run.signal!.media.push({ ...run.signal!.media[0], id: 'FIXTURE-extra-media' });
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('比較A・Bの図面を並べて拡大');
    expect(html.match(/<dialog\b/g)).toHaveLength(3);
    expect(html).toContain('/api/v1/media/FIXTURE-extra-media');
  });
  it('preserves the two individual enlarged images in the existing result', () => {
    const html = renderToStaticMarkup(createElement(SignalResult, { run: fictionalRun }));
    expect(html.match(/<dialog\b/g)).toHaveLength(2);
    expect(html).toContain('/api/v1/media/media-a');
    expect(html).toContain('/api/v1/media/media-b');
  });
});

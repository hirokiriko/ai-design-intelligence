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

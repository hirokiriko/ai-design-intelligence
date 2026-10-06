import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeferredDetails } from './DeferredDetails';

describe('DeferredDetails', () => {
  it('keeps technical children out of the initial customer markup', () => {
    const html = renderToStaticMarkup(
      createElement(DeferredDetails, {
        summary: '技術・検証情報',
        children: createElement('p', null, 'Backend Contract adapter accepted'),
      }),
    );

    expect(html).toContain('技術・検証情報');
    expect(html).not.toContain('Backend Contract');
    expect(html).not.toContain('adapter');
    expect(html).not.toContain('accepted');
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/i);
  });

  it('mounts the technical body when opened', () => {
    const html = renderToStaticMarkup(
      createElement(DeferredDetails, {
        initiallyOpen: true,
        summary: '技術・検証情報',
        children: createElement('p', null, '検証用の詳細'),
      }),
    );

    expect(html).toContain('検証用の詳細');
    expect(html).toMatch(/<details[^>]*\bopen(?:=|>)/i);
  });
});

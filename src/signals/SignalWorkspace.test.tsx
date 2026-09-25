import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fictionalComparisonPair } from './fixtures-v22';
import { ComparisonPairSelector } from './SignalWorkspace';

describe('comparison pair selection', () => {
  it('explains the fictional comparison status while preserving candidate values', () => {
    const pair = structuredClone(fictionalComparisonPair);
    const status = pair.media[0].comparisonStatus;
    const html = renderToStaticMarkup(createElement(ComparisonPairSelector, {
      pairs: [pair], state: 'ready', selectedId: pair.id, busy: false,
      onSelect: () => undefined, onReload: () => undefined,
    }));
    expect(html).toContain('次の実行に使う比較組');
    expect(html).toContain('管理者が架空資料を対応づけ済み（商品の新旧世代は未確認）');
    expect(html).not.toContain(status);
    expect(pair.media[0].comparisonStatus).toBe(status);
  });
});

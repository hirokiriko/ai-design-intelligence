import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fictionalComparisonPair } from './fixtures-v22';
import { comparisonStatusLabel } from './labels';
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
  it('hides unknown backend comparison codes in the selection while retaining the candidate', () => {
    const pair = structuredClone(fictionalComparisonPair);
    pair.media[0].comparisonStatus = 'orientation_unverified';
    pair.media[1].comparisonStatus = 'orientation_unverified';
    const html = renderToStaticMarkup(createElement(ComparisonPairSelector, {
      pairs: [pair], state: 'ready', selectedId: pair.id, busy: false,
      onSelect: () => undefined, onReload: () => undefined,
    }));
    expect(html).toContain('比較条件の詳細は未確認');
    expect(html).not.toContain('orientation_unverified');
    expect(pair.media[0].comparisonStatus).toBe('orientation_unverified');
  });
  it('explains a registered unknown scale and retains descriptive Japanese input', () => {
    expect(comparisonStatusLabel('scale_unknown')).toBe('縮尺は未確認');
    expect(comparisonStatusLabel('同方向を確認')).toBe('同方向を確認');
    expect(comparisonStatusLabel('3D形状の縮尺は未確認')).toBe('3D形状の縮尺は未確認');
  });
});

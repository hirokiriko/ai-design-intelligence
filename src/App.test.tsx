import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App primary task flow', () => {
  it('explains the product, six-step flow, and sample-data boundary before analysis', () => {
    const html = renderToStaticMarkup(createElement(App));

    expect(html).toContain('KIRIKO Design Signals');
    expect(html).toContain('サンプルデータ版です。');
    expect(html).toContain('すべて架空');
    expect(html).toContain('実在企業・実在公報ではありません');
    expect(html).toContain('意匠情報から、市場・企業・商品化領域の先行シグナルを捉える');
    expect(html).toContain('対象を決める');
    expect(html).toContain('1. 分析対象を決める');
    expect(html).toContain('2. 見たい領域を決める');
    expect(html).toContain('3. 対象となる意匠情報を決める');
    expect(html).toContain('4. 対象期間を決める');
    expect(html).toContain('5. 分析目的を選ぶ');
    expect(html).toContain('6. 結果と根拠を確認する');
    expect(html).toContain('詳細設定・データ情報');
    expect(html).toContain('分析条件を決める');
    expect(html).toContain('分析を開始');
    expect(html).toContain('分析すると得られること');
    expect(html).toContain('tabindex="-1"');
    expect(html.indexOf('1. 分析対象を決める')).toBeLessThan(html.indexOf('詳細設定・データ情報'));
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/i);
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toContain('<img');
  });
});

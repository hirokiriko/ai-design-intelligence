import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App primary task flow', () => {
  it('explains the purpose, three-step flow, and sample-data boundary before analysis', () => {
    const html = renderToStaticMarkup(createElement(App));

    expect(html).toContain('サンプルデータ版です。');
    expect(html).toContain('すべて架空');
    expect(html).toContain('実在企業・実在公報ではありません');
    expect(html).toContain('競合や市場の意匠から、次に注目すべき商品領域と出願戦略のヒントを見つける');
    expect(html).toContain('対象を決める');
    expect(html).toContain('知りたいことを選ぶ');
    expect(html).toContain('示唆と根拠を見る');
    expect(html).toContain('任意：データ・デモ設定');
    expect(html).toContain('分析条件を決める');
    expect(html).toContain('意匠情報を、先行商品戦略＆知財戦略へ活用');
    expect(html).toContain('AI分析開始');
    expect(html).toContain('分析すると得られること');
    expect(html).toContain('tabindex="-1"');
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/i);
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toContain('<img');
  });
});

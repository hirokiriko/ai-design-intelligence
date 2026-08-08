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
    expect(html).toContain('特許情報より早く公表される「意匠情報」を活用し、商品開発領域や企業戦略の先行ヒントを得る');
    expect(html).toContain('案件や制度によって公表時期は異なるため');
    expect(html).toContain('対象を決める');
    expect(html).toContain('見たい領域を決める');
    expect(html).toContain('結果と根拠を確認する');
    expect(html).toContain('詳細設定・データ情報');
    expect(html).toContain('分析条件を決める');
    expect(html).toContain('市場全体');
    expect(html).toContain('特定業界');
    expect(html).toContain('特定企業');
    expect(html).toContain('プリセットA：家電・映像機器');
    expect(html).toContain('プリセットB：画像意匠');
    expect(html).toContain('分析を開始');
    expect(html).toContain('分析すると得られること');
    expect(html).not.toContain('信頼度：');
    expect(html).toContain('tabindex="-1"');
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/i);
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toContain('<img');
  });
});

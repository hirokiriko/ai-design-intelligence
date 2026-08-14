import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App primary task flow', () => {
  it('uses the approved product name, tagline, and fictional-data boundary', () => {
    const html = renderToStaticMarkup(createElement(App));

    expect(html).toContain('KIRIKO Design Signals');
    expect(html).toContain('意匠情報から、市場・企業・商品化領域の先行シグナルを捉える');
    expect(html).not.toContain('AI Design Intelligence');
    expect(html).toContain('サンプルデータ版です。');
    expect(html).toContain('すべて架空');
    expect(html).toContain('実在企業・実在公報ではありません');
    expect(html).toContain('他の知財情報、商品情報、事業情報等と組み合わせて検討できます');
    expect(html).not.toContain('特許情報より早');
    expect(html).not.toContain('将来を予測');
    expect(html).not.toContain('企業戦略を特定');
    expect(html).not.toContain('侵害判断');
    expect(html).not.toContain('AI分析開始');
    expect(html).not.toContain('保護されたデモデータを読み込む');
    expect(html).not.toContain('/api/demo-designs');
  });

  it('presents the proposal flow without exposing technical status as the headline', () => {
    const html = renderToStaticMarkup(createElement(App));

    expect(html).toContain('対象を決める');
    expect(html).toContain('見たい領域を決める');
    expect(html).toContain('結果と根拠を確認する');
    expect(html).toContain('aria-label="分析の流れ"');
    expect(html).not.toContain('bg-accent text-sm font-bold text-white">1</span>');
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

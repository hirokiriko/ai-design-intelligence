import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App primary task flow', () => {
  it('starts every fresh mount in sample mode without a persisted Contract classification', () => {
    const firstMount = renderToStaticMarkup(createElement(App));
    const reloadedMount = renderToStaticMarkup(createElement(App));

    for (const html of [firstMount, reloadedMount]) {
      expect(html).toContain('サンプルデータ版です。');
      expect(html).not.toContain('公開意匠データを使用中');
      expect(html).not.toContain('fictional_contract_fixture');
      expect(html).not.toContain('approved_public_design_demo');
      expect(html).not.toContain('unclassified_contract');
    }
  });

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
    const formalStepLabels = [
      '1. 分析対象を決める',
      '2. 見たい領域を決める',
      '3. 対象となる意匠情報を決める',
      '4. 対象期間を決める',
      '5. 分析目的を選ぶ',
      '6. 結果と根拠を確認する',
    ];
    const formalStepSequence = Array.from(
      html.matchAll(/1\. 分析対象を決める|2\. 見たい領域を決める|3\. 対象となる意匠情報を決める|4\. 対象期間を決める|5\. 分析目的を選ぶ|6\. 結果と根拠を確認する/g),
      (match) => match[0],
    );
    expect(formalStepSequence).toEqual(formalStepLabels);
    expect(html.indexOf(formalStepLabels[0])).toBeLessThan(html.indexOf('詳細設定・データ情報'));

    const overviewFlow = html.match(/<ul aria-label="分析の流れ"[\s\S]*?<\/ul>/)?.[0] ?? '';
    expect(overviewFlow).not.toBe('');
    expect(overviewFlow).not.toMatch(/>\s*[123]\s*</);

    const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? '';
    expect(header).not.toBe('');
    ['デモ用サンプルデータ', 'ルールベース分析', '外部データ未接続'].forEach((label) => {
      expect(header).not.toContain(label);
    });
    expect(html).toContain('技術・検証情報');
    expect(html).not.toContain('Backend Contract');
    expect(html).not.toContain('accepted');
    expect(html).not.toContain('excluded');
    expect(html).not.toContain('adapter');
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/i);
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toContain('<img');
  });
});

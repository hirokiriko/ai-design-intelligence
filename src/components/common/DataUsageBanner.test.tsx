import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataUsageBanner } from './DataUsageBanner';

describe('DataUsageBanner', () => {
  it('shows customer-facing Backend data status with values supplied by the accepted Contract', () => {
    const firstHtml = renderToStaticMarkup(
      createElement(DataUsageBanner, {
        mode: 'backend',
        acceptedCount: 17,
        analysisCutoff: '2099-12-31',
      }),
    );
    const secondHtml = renderToStaticMarkup(
      createElement(DataUsageBanner, {
        mode: 'backend',
        acceptedCount: 29,
        analysisCutoff: '2098-01-02',
      }),
    );

    expect(firstHtml).toContain('公開意匠実データを使用中');
    expect(firstHtml).toContain('role="status"');
    expect(firstHtml).toContain('aria-live="polite"');
    expect(firstHtml).toContain('分析対象件数');
    expect(firstHtml).toContain('17件');
    expect(firstHtml).toContain('2099年12月31日');
    expect(firstHtml).toContain('取得済みの週次更新差分');
    expect(firstHtml).toContain('初回提案向けの限定デモ');
    expect(firstHtml).toContain('日本の全意匠を網羅するものではなく');
    expect(firstHtml).toContain('最新の法的状態や完全な市場母集団を示すものではありません');
    expect(firstHtml).toContain('ブラウザのメモリ上だけで扱い');
    expect(firstHtml).toContain('公開Preview・公開ビルドには含めません');
    expect(firstHtml).not.toContain('Backend Contract');
    expect(firstHtml).not.toContain('analysis-ready');
    expect(firstHtml).not.toContain('サンプルデータ版');
    expect(firstHtml).not.toContain('ローカル検証データ');

    expect(secondHtml).toContain('29件');
    expect(secondHtml).toContain('2098年1月2日');
    expect(secondHtml).not.toContain('17件');
    expect(secondHtml).not.toContain('2099年12月31日');
  });

  it('keeps sample and legacy explanations separate from the Backend real-data indicator', () => {
    const sampleHtml = renderToStaticMarkup(createElement(DataUsageBanner, { mode: 'sample' }));
    const legacyHtml = renderToStaticMarkup(createElement(DataUsageBanner, { mode: 'legacy' }));

    expect(sampleHtml).toContain('サンプルデータ版です。');
    expect(sampleHtml).toContain('すべて架空');
    expect(sampleHtml).not.toContain('公開意匠実データを使用中');
    expect(sampleHtml).not.toContain('ローカル検証データを使用中');

    expect(legacyHtml).toContain('ローカル検証データを使用中です。');
    expect(legacyHtml).not.toContain('公開意匠実データを使用中');
    expect(legacyHtml).not.toContain('サンプルデータ版');
  });
});

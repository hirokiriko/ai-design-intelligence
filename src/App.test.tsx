import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App public demo defaults', () => {
  it('starts in external demo mode and clearly labels the public sample version', () => {
    const html = renderToStaticMarkup(createElement(App));

    expect(html).toContain('この公開デモはサンプルデータ版です。');
    expect(html).toContain('サンプルはすべて架空データ');
    expect(html).toContain('実在企業・実在公報ではありません');
    expect(html).toContain('特許庁実データを用いた検証版は画面共有でご説明します');
    expect(html).toContain('外部デモモード');
    expect(html).toContain('ON');
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/[A-Za-z]:\\/);
    expect(html).not.toContain('<img');
  });
});

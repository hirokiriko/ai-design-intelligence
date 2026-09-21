import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignalResult } from './SignalResult';
import { SignalHistory } from './SignalHistory';
import { fictionalRun, fictionalRunV2 } from './fixtures';
import { relationLabels } from './labels';

describe('saved company and evidence context', () => {
  it('leads with the saved company, product, classification, change and official findings', () => {
    const html = renderToStaticMarkup(createElement(SignalResult, { run: fictionalRunV2 }));
    for (const label of ['架空リーフ機器株式会社', '架空のリーフ操作器', '操作機器 / H1', '今回わかったこと', '関連する公式記載', '未確認事項・次に確認する資料', '処理終了は、同一製品', '比較A / Bは資料の役割', '発表日：不明', '更新日：2026-07-02', '発売日：不明', '物品名', '架空操作機器', 'AIが確認した抜粋']) expect(html).toContain(label);
    expect(html.indexOf('今回わかったこと')).toBeLessThan(html.indexOf('画像からのAI観察候補'));
  });
  it.each(Object.entries(relationLabels))('distinguishes relationship %s without broad confirmation', (relation, label) => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.relationships[0].relation = relation as keyof typeof relationLabels;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain(label);
    expect(html).toContain('支持する根拠'); expect(html).toContain('不足している根拠');
    expect(html).not.toContain('調査完了'); expect(html).not.toContain('確認完了');
  });
  it('separates approved public data from a fixture model using only fictional test values', () => {
    const run = structuredClone(fictionalRunV2);
    run.input.context.dataMode = 'approved_public';
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('承認済み公開実データ'); expect(html).toContain('模擬モデル（接続・保存の検証）');
    expect(html).toContain('架空リーフ機器株式会社');
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run, fictionalRun], state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(history).toContain('承認済み公開実データ'); expect(history).toContain('架空データ（旧形式）');
    expect(renderToStaticMarkup(createElement(SignalResult, { run: fictionalRun }))).toContain('現在のカタログから補完していません');
  });
  it('exposes saved but model-unseen excerpt text separately and reports unknown dates', () => {
    const run = structuredClone(fictionalRunV2);
    const source = run.signal!.sources[0];
    source.excerpt += 'これはAI未確認の範囲です。';
    source.extractedChars = Array.from(source.excerpt).length; source.truncated = true;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('保存された抜粋の残り（AIは未確認）');
    expect(html).toContain('全文確認ではありません'); expect(html).toContain('日付不明');
    expect(html).toContain('事後照合'); expect(html).toContain('これはAI未確認の範囲です。');
  });
  it('escapes product, relation and source labels as text', () => {
    const run = structuredClone(fictionalRunV2);
    run.input.context.entity.name = '<script>external()</script>';
    run.signal!.relationships[0].summary = '<img src=x onerror=external()>';
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=external()&gt;');
  });
  it('shows missing entity and article names explicitly without substituting identity IDs', () => {
    const run = structuredClone(fictionalRunV2);
    run.input.context.entity.name = null;
    run.signal!.recordFacts[0].articleName = null; run.signal!.recordFacts[0].applicant.name = null;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('企業名不明 / 操作機器 / H1');
    expect(html).toContain('<dt>物品名</dt><dd>不明</dd>');
    expect(html).toContain('<dt>出願人</dt><dd>不明</dd>');
  });
  it('links Unicode evidence IDs to a real fragment target after browser URL decoding', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.officialFacts[0].id = '公式記載-1';
    run.signal!.relationships[0].supportingEvidenceIds = ['公式記載-1'];
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    const linkedId = html.match(/href="#([^"]+)">公式記載-1<\/a>/)?.[1];
    expect(linkedId).toBeDefined();
    expect(html).toContain(`id="${decodeURIComponent(linkedId!)}"`);
  });
  it('shows original identifiers and article description separately from a missing design description', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.recordFacts[0].description = null;
    run.signal!.recordFacts[0].articleDescription = '架空の物品機能の説明';
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('登録番号 / 出願番号'); expect(html).toContain('FIXTURE-REG-EXAMPLE / 不明');
    expect(html).toContain('<dt>意匠の説明</dt><dd>説明は未収録</dd>');
    expect(html).toContain('<dt>物品の説明</dt><dd>架空の物品機能の説明</dd>');
  });
});

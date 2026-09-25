import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignalResult } from './SignalResult';
import { SavedContext } from './SignalContext';
import { SignalHistory } from './SignalHistory';
import { fictionalRun, fictionalRunV2 } from './fixtures';
import { fictionalRunV22 } from './fixtures-v22';
import { relationLabels } from './labels';
import { decodeRun } from './contract';
import backendReconstruction from './backend-run-v2.1.fixture.json';

describe('saved company and evidence context', () => {
  it('translates saved classification schemes while retaining the classification codes', () => {
    const run = structuredClone(fictionalRunV2);
    run.input.context.category.scheme = 'JPO_NATIONAL_DESIGN';
    run.signal!.recordFacts[0].classifications = [{ scheme: 'JPO_D_TERM', code: 'D-FIXTURE', label: null }];
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('<dt>分類体系</dt><dd>日本意匠分類</dd>');
    expect(html).toContain('Dターム D-FIXTURE');
    expect(html).not.toContain('JPO_NATIONAL_DESIGN');
    expect(html).not.toContain('JPO_D_TERM');
  });
  it('shows the saved 2.2.0 pair and reconstruction without using current catalog labels', () => {
    const run = structuredClone(fictionalRunV22);
    run.input.comparisonPair!.label = '保存時の架空比較組';
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('この実行に保存された比較組');
    expect(html).toContain('保存時の架空比較組');
    expect(html).toContain('週次原本からの遡及再構成収録集合');
    expect(html).toContain('比較Aの対象');
    expect(html).toContain('比較Bの対象');
    run.input.comparisonPair = null;
    expect(renderToStaticMarkup(createElement(SignalResult, { run }))).toContain('現在の候補から過去の入力を補完していません');
  });
  it('explains the saved fictional comparison status without rewriting the saved input', () => {
    const run = structuredClone(fictionalRunV22);
    const status = run.input.comparisonPair!.media[0].comparisonStatus;
    const html = renderToStaticMarkup(createElement(SavedContext, { run }));
    expect(html).toContain('管理者が架空資料を対応づけ済み（商品の新旧世代は未確認）');
    expect(html).not.toContain(status);
    expect(run.input.comparisonPair!.media[0].comparisonStatus).toBe(status);
  });
  it('displays reconstructed collection limits and unknown acquisition without changing saved counts', () => {
    const run = decodeRun(backendReconstruction);
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    for (const label of ['比較A · 週次原本からの遡及再構成収録集合', '比較B · 週次原本からの遡及再構成収録集合', '共通の収録開始日', '収録の締切日 / 判定基準', '原本の公開日', '不明（手元での確認日時とは区別）', '手元で原本を確認した日時', '再構成した日時', '事後の補足', '当時の予測実績を示すものではありません', '2026-06-01', '2026-08-09', '2026-09-18', '比較Bの対象2件、収録範囲での新規観測1件。', '個別意匠と商品の対応', '公式資料の探索範囲と不足']) expect(html).toContain(label);
    expect(html).toContain('自作架空原本による遡及再構成の回帰fixture');
    expect(html).toContain('後日取得した資料を事後の補足として含みます。当時サービスが取得済みだったことを示しません。');
    expect(html).not.toContain('当時既知の情報ではありません');
    expect(html.indexOf('週次原本からの遡及再構成収録集合')).toBeLessThan(html.indexOf('画像からのAI観察候補'));
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run], state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(history).toContain('架空意匠ラボ甲合同会社');
    expect(history).not.toContain('架空データ（旧形式）');
  });
  it('shows saved acquisition evidence and absent supplements without fabricating missing collection metadata', () => {
    const run = decodeRun(structuredClone(backendReconstruction));
    if (run.schemaVersion !== '2.1.0') throw new Error('Fixture must use 2.1.0');
    const collection = run.input.context.beforeDataset.collection!;
    collection.sourceAcquiredFrom = '2026-09-19T00:00:00Z';
    collection.sourceAcquiredThrough = '2026-09-20T00:00:00Z';
    collection.retrospectiveSupplements = false;
    run.input.context.afterDataset.collection = null;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('2026-09-19T00:00:00Z 〜 2026-09-20T00:00:00Z');
    expect(html).toContain('この収録集合には登録されていません。');
    expect(html).toContain('比較B：収録集合の作成経緯は未記録です。');
    expect(renderToStaticMarkup(createElement(SignalResult, { run: fictionalRunV2 }))).not.toContain('遡及再構成収録集合');
  });
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
    expect(html).toContain('公開情報由来のデータ'); expect(html).toContain('模擬モデル（接続・保存の検証）');
    expect(html).toContain('架空リーフ機器株式会社');
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run, fictionalRun], state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(history).toContain('公開情報由来のデータ'); expect(history).toContain('架空データ（旧形式）');
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
    const linkedId = html.match(/href="#([^"]+)">公式記載1<\/a>/)?.[1];
    expect(linkedId).toBeDefined();
    expect(html).toContain(`id="${decodeURIComponent(linkedId!)}"`);
    expect(html).not.toContain('>公式記載-1</a>');
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

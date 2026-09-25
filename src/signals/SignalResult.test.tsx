import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignalResult } from './SignalResult';
import { fictionalRun, fictionalRunV2 } from './fixtures';
import { fictionalRunV22 } from './fixtures-v22';
import { evidenceId } from './labels';

const officialFactCard = (html: string, id: string) => html.split(`id="${evidenceId(id)}"`)[1]?.split('</div>')[0] ?? '';

describe('signal facts and saved result presentation', () => {
  it('separates factual sources, AI observations, hypotheses and unknown dates', () => {
    const html = renderToStaticMarkup(createElement(SignalResult, { run: fictionalRun }));
    for (const label of ['意匠データの事実', '画像からのAI観察候補', '公式発表の事実', '関連仮説 · 未確認', '不明点・資料の限界', '公開日：不明', '事後照合', '公報日', '出願日', '縮尺は未確認', '保存条件・実行情報']) expect(html).toContain(label);
    expect(html).toContain('/api/v1/media/media-a');
    expect(html).toContain(`href="#${evidenceId('source-1')}"`);
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it('shows the matching source title and announcement date beside each official fact', () => {
    const run = structuredClone(fictionalRunV2);
    const firstSource = run.signal!.sources[0];
    firstSource.title = '架空カタログ2026';
    firstSource.publishedAt = '2025-10-31';
    run.signal!.sources.unshift({ ...firstSource, id: 'source-2', title: '架空の別資料', publishedAt: '2026-06-15' });
    run.signal!.officialFacts.push({ ...run.signal!.officialFacts[0], id: 'official-2', sourceId: 'source-2' });
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    const firstFact = officialFactCard(html, 'official-1');
    const secondFact = officialFactCard(html, 'official-2');
    expect(firstFact).toContain('出典：架空カタログ2026 · 発表日：2025-10-31');
    expect(firstFact).toContain('比較Aの基準日より前の発表です。');
    expect(firstFact).toContain(`href="#${evidenceId('source-1')}"`);
    expect(firstFact).not.toContain('架空の別資料');
    expect(secondFact).toContain('出典：架空の別資料 · 発表日：2026-06-15');
    expect(secondFact).toContain(`href="#${evidenceId('source-2')}"`);
    expect(secondFact).not.toContain('架空カタログ2026');
    expect(secondFact).not.toContain('比較Aの基準日より前');
  });
  it('keeps unknown announcement dates unknown instead of using retrieval or update dates', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.sources[0].title = '';
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    const fact = officialFactCard(html, 'official-1');
    expect(fact).toContain('出典：タイトル不明 · 発表日：不明');
    expect(fact).not.toContain(run.signal!.sources[0].retrievedAt);
    expect(fact).not.toContain(run.signal!.sources[0].updatedAt);
    expect(fact).not.toContain('比較Aの基準日より前');
  });
  it('does not label an announcement on the comparison A date as earlier', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.sources[0].publishedAt = run.input.context.beforeDataset.dataAsOf;
    const fact = officialFactCard(renderToStaticMarkup(createElement(SignalResult, { run })), 'official-1');
    expect(fact).toContain('発表日：2026-06-01');
    expect(fact).not.toContain('比較Aの基準日より前');
  });
  it.each([null, '2025-10-31'])('shows legacy source dates without inventing a comparison boundary: %s', (publishedAt) => {
    const run = structuredClone(fictionalRun);
    run.signal!.sources[0].publishedAt = publishedAt;
    const fact = officialFactCard(renderToStaticMarkup(createElement(SignalResult, { run })), 'official-1');
    expect(fact).toContain(`出典：架空の操作機器のお知らせ · 公開日：${publishedAt ?? '不明'}`);
    expect(fact).toContain(`href="#${evidenceId('source-1')}"`);
    expect(fact).not.toContain('比較Aの基準日より前');
  });
  it('escapes externally supplied HTML and uses an accessible expansion control', () => {
    const run = structuredClone(fictionalRun);
    run.signal!.designFacts[0].text = '<img src=x onerror=alert(1)>';
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('aria-label="旧操作機器を拡大"');
    expect(html).toContain('<dialog');
  });
  it('keeps each enlarged image attributed to its saved source and comparison context', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.media[0].sourceLabel = '架空の比較A図面 <出所>';
    run.signal!.media[0].view = null;
    run.signal!.media[0].gazetteDate = null;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    const dialogs = [...html.matchAll(/<dialog\b[^>]*>([\s\S]*?)<\/dialog>/g)].map((match) => match[1]);
    expect(dialogs).toHaveLength(2);
    expect(dialogs[0]).toContain('架空の比較A図面 &lt;出所&gt;');
    expect(dialogs[0]).toContain('旧操作機器 / 不明');
    expect(dialogs[0]).toContain('<dt>公報日 / 出願日</dt><dd>不明 / 不明</dd>');
    expect(dialogs[0]).toContain('方向不明 / 縮尺は未確認');
    expect(dialogs[0]).not.toContain('FIXTURE-REG-EXAMPLE');
    expect(dialogs[1]).toContain('架空操作機器 / FIXTURE-REG-EXAMPLE');
    expect(dialogs[1]).toContain('<dt>公報日 / 出願日</dt><dd>2026-07-01 / 不明</dd>');
    expect(dialogs[1]).toContain('正面 / 縮尺は未確認');
    for (const dialog of dialogs) {
      expect(dialog).toContain('審査用に作成');
      expect(dialog).toContain('形状比較とAI観察候補の内容を確かめるための根拠資料');
      expect(dialog).toContain('商品の新旧世代や発売順を示しません');
      expect(dialog.indexOf('情報源・利用条件')).toBeLessThan(dialog.indexOf('<img'));
    }
  });
  it('uses the fictional comparison explanation in image text, metadata and enlargement', () => {
    const run = structuredClone(fictionalRunV22);
    const status = run.signal!.media[0].comparisonStatus;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain(`alt="${run.signal!.media[0].label}。${run.signal!.media[0].view}。管理者が架空資料を対応づけ済み（商品の新旧世代は未確認）"`);
    expect(html).toContain('方向・対応条件</dt><dd>');
    expect(html.match(/管理者が架空資料を対応づけ済み（商品の新旧世代は未確認）/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).not.toContain(status);
    expect(run.signal!.media[0].comparisonStatus).toBe(status);
  });
  it('uses saved public labels and one sentence boundary without exposing record or dataset IDs', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.coverage.before = '架空比較Aの範囲。 ';
    run.signal!.coverage.after = '架空比較Bは全国を網羅しない。 ';
    run.signal!.relationships[0].supportingEvidenceIds.push('fact-1');
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('比較A：架空比較Aの範囲 ／ 比較B：架空比較Bは全国を網羅しない。比較可能な収録条件です。');
    expect(html).toContain('根拠意匠：架空操作機器（登録番号 FIXTURE-REG-EXAMPLE） を確認');
    expect(html).toContain('<dt>比較A / 比較Bの基準日</dt><dd>2026-06-01 / 2026-07-01</dd>');
    expect(html).toContain('項目：物品名');
    expect(html).toContain('>意匠の事実1</a>');
    expect(html).toContain('>参照先1</a>');
    expect(html).toContain('<dt>実行日時</dt><dd>2026-07-01T01:00:00Z</dd>');
    for (const internal of ['record-old', 'record-new', 'dataset-before', 'dataset-after', 'entity-example', 'category-controller', 'source-profile-example', 'fact-1', 'articleName', 'run-example-v2', 'fetch_candidate']) expect(html).not.toContain(internal);
  });
  it('keeps multiple legacy evidence controls distinct when public record metadata is unavailable', () => {
    const run = structuredClone(fictionalRun);
    run.signal!.media = [];
    run.signal!.designFacts[0].recordIds = ['legacy-record-one', 'legacy-record-two'];
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('根拠意匠：事実1の候補1（物品名未確認） を確認');
    expect(html).toContain('根拠意匠：事実1の候補2（物品名未確認） を確認');
    expect(html).not.toContain('legacy-record-one');
    expect(html).not.toContain('legacy-record-two');
  });
  it('renders saved classification summaries with public scheme names and one comparison sentence', () => {
    const run = structuredClone(fictionalRunV2);
    const savedText = '架空のドライヤー。出願人: 架空企業。公報日: 2026-07-01。出願日: 不明。分類: JPO_NATIONAL_DESIGN:B7-3490 (ラベル不明)、JPO_D_TERM:D1、LOCARNO:28。説明: LOCARNO:28 は保存された説明文です。';
    run.signal!.designFacts[0].field = 'record';
    run.signal!.designFacts[0].text = savedText;
    run.signal!.coverage.after = '全国を網羅しない 。 ';
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('分類: 日本意匠分類 B7-3490 (ラベル不明)、Dターム D1、ロカルノ分類 28。説明: LOCARNO:28 は保存された説明文です。');
    expect(html).toContain('比較B：全国を網羅しない。比較可能な収録条件です。');
    expect(html).not.toContain('全国を網羅しない 。');
    for (const internal of ['分類: JPO_NATIONAL_DESIGN:', '、JPO_D_TERM:', '、LOCARNO:']) expect(html).not.toContain(internal);
    expect(run.signal!.designFacts[0].text).toBe(savedText);
  });
  it('shows absent images and failures independently from no-change results', () => {
    const run = structuredClone(fictionalRun);
    run.signal!.media = []; run.signal!.visualObservations = [];
    expect(renderToStaticMarkup(createElement(SignalResult, { run }))).toContain('画像は未取得です');
    run.status = 'failed'; run.signal = null;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('API・AI処理の失敗');
    expect(html).toContain('変化なしという結果ではありません');
  });
  it('clearly labels fixture model results and separates partial execution from insufficient evidence', () => {
    const run = structuredClone(fictionalRun);
    run.versions.model = 'fixture-controller';
    expect(renderToStaticMarkup(createElement(SignalResult, { run }))).toContain('模擬モデル（接続・保存の検証）');
    run.status = 'partial'; run.signal = null;
    expect(renderToStaticMarkup(createElement(SignalResult, { run }))).toContain('資料不足という通常の結果とは別');
  });
});

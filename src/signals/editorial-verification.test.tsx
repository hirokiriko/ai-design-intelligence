import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { decodeEditorialComparison, EditorialComparisonError, loadEditorialComparison, type EditorialComparison, type EditorialVerification } from './editorial-comparison';
import { SignalEditorialComparison } from './SignalEditorialComparison';

function fixture(): EditorialComparison & { verification: EditorialVerification } {
  const retrievedAt = '2024-03-01T01:02:03.123456Z';
  return {
    version: 2, companyName: 'FIXTURE-Company', title: '架空製品の仕様比較',
    products: [{ label: 'FIXTURE-Alpha' }, { label: 'FIXTURE-Beta' }],
    differences: [
      { label: '素材', values: ['架空素材A', '架空素材B'], sourceIds: ['kds_fixture_A', 'kds_fixture_B'] },
      { label: '準備時間', values: ['12秒', '約15秒'], sourceIds: ['kds_fixture_A', 'kds_fixture_PRESS'] },
    ],
    condition: '架空の所定温度に達するまでの条件を比較。', whyItMatters: '架空素材と準備時間を分けて検討する。', nextQuestion: '同じ設置条件で比較できるか？',
    announcement: { publishedAt: '2024-02-29', releaseWindow: '春予定', sourceId: 'kds_fixture_PRESS' },
    manufacturerClaim: { text: '架空のメーカー説明を条件付きで整理。', sourceId: 'kds_fixture_B' },
    limitations: ['因果・後継関係は未確認。'],
    sources: [
      { id: 'kds_fixture_A', label: '架空A仕様', url: 'https://example.test/products/fixture-a', notes: '今回の取得メモA。' },
      { id: 'kds_fixture_B', label: '架空B仕様', url: 'https://example.test/products/fixture-b', notes: '今回の取得メモB。' },
      { id: 'kds_fixture_PRESS', label: '架空の発表記事', url: 'https://example.test/news/fixture', notes: '仕様条件・日付を記録。' },
    ],
    verification: {
      checkedAt: '2024-03-01T01:03:00Z',
      quotes: [
        { id: 'kds_fixture_A_material', sourceId: 'kds_fixture_A', text: '架空素材Aを使用。', retrievedAt },
        { id: 'kds_fixture_B_material', sourceId: 'kds_fixture_B', text: '架空素材Bを使用。', retrievedAt },
        { id: 'kds_fixture_A_time', sourceId: 'kds_fixture_A', text: '準備時間12秒。', retrievedAt },
        { id: 'kds_fixture_PRESS_time', sourceId: 'kds_fixture_PRESS', text: '共通特長：準備時間約15秒。', retrievedAt },
        { id: 'kds_fixture_condition', sourceId: 'kds_fixture_PRESS', text: '所定温度に達するまで。\nFIXTURE <条件> を維持。', retrievedAt },
        { id: 'kds_fixture_date', sourceId: 'kds_fixture_PRESS', text: '2024年2月29日発表、春発売予定。', retrievedAt },
        { id: 'kds_fixture_claim', sourceId: 'kds_fixture_B', text: '架空の試験条件で比較。', retrievedAt },
      ],
      differenceQuoteIds: [[['kds_fixture_A_material'], ['kds_fixture_B_material']], [['kds_fixture_A_time'], ['kds_fixture_PRESS_time']]],
      conditionQuoteIds: ['kds_fixture_condition'], announcementQuoteIds: ['kds_fixture_date'], manufacturerClaimQuoteIds: ['kds_fixture_claim'],
    },
  };
}

describe('current official excerpt bindings in private comparison v2', () => {
  it('preserves every literal quote, source, value and acquisition timestamp', () => {
    const input = fixture(), before = structuredClone(input);
    expect(decodeEditorialComparison(input, input.companyName)).toEqual(before);
    expect(input).toEqual(before);
  });

  it.each([
    ['missing verification', (data: ReturnType<typeof fixture>) => { Reflect.deleteProperty(data, 'verification'); }],
    ['unknown verification field', (data: ReturnType<typeof fixture>) => { Object.assign(data.verification, { runId: 'kds_fixture_run' }); }],
    ['duplicate quote', (data: ReturnType<typeof fixture>) => { data.verification.quotes.push(data.verification.quotes[0]); }],
    ['unknown source', (data: ReturnType<typeof fixture>) => { data.verification.quotes[0].sourceId = 'kds_fixture_unknown'; }],
    ['source without quote', (data: ReturnType<typeof fixture>) => { data.sources.push({ ...data.sources[0], id: 'kds_fixture_unused' }); }],
    ['invalid quote id', (data: ReturnType<typeof fixture>) => { data.verification.quotes[0].id = '../fixture'; }],
    ['empty quote', (data: ReturnType<typeof fixture>) => { data.verification.quotes[0].text = ' '; }],
    ['control in quote', (data: ReturnType<typeof fixture>) => { data.verification.quotes[0].text += '\u0000'; }],
    ['invalid checked date', (data: ReturnType<typeof fixture>) => { data.verification.checkedAt = '2024-02-30T01:03:00Z'; }],
    ['ambiguous acquisition time', (data: ReturnType<typeof fixture>) => { data.verification.quotes[0].retrievedAt = '2024-03-01'; }],
    ['acquired after checking', (data: ReturnType<typeof fixture>) => { data.verification.quotes[0].retrievedAt = '2024-03-02T01:03:00Z'; }],
    ['missing row', (data: ReturnType<typeof fixture>) => { data.verification.differenceQuoteIds.pop(); }],
    ['unbound value', (data: ReturnType<typeof fixture>) => { data.verification.differenceQuoteIds[1][1] = []; }],
    ['unknown quote', (data: ReturnType<typeof fixture>) => { data.verification.differenceQuoteIds[1][1] = ['kds_fixture_missing']; }],
    ['wrong row sources', (data: ReturnType<typeof fixture>) => { data.differences[1].sourceIds = ['kds_fixture_A', 'kds_fixture_B']; }],
    ['wrong announcement source', (data: ReturnType<typeof fixture>) => { data.verification.announcementQuoteIds = ['kds_fixture_A_time']; }],
    ['wrong claim source', (data: ReturnType<typeof fixture>) => { data.verification.manufacturerClaimQuoteIds = ['kds_fixture_PRESS_time']; }],
    ['unused quote', (data: ReturnType<typeof fixture>) => { data.verification.quotes.push({ ...data.verification.quotes[0], id: 'kds_fixture_unused' }); }],
  ] as const)('rejects %s instead of repairing the saved evidence', (_label, mutate) => {
    const input = fixture(); mutate(input);
    expect(() => decodeEditorialComparison(input, input.companyName)).toThrow(EditorialComparisonError);
  });

  it('connects each value to its own quote and correct source, including values recorded only in a press article', () => {
    const input = fixture(), before = structuredClone(input);
    const html = renderToStaticMarkup(createElement(SignalEditorialComparison, { comparison: input, summaryOnly: true }));
    const cells = [...html.matchAll(/<td>(.*?)<\/td>/g)].map((match) => match[1]);
    expect(cells).toHaveLength(4);
    expect(cells[1]).toContain('#signal-editorial-quote-kds_fixture_B_material');
    expect(cells[3]).toContain('#signal-editorial-quote-kds_fixture_PRESS_time');
    expect(cells[3]).not.toContain('kds_fixture_B_material');
    for (const quote of input.verification.quotes) {
      const section = html.slice(html.indexOf(`id="signal-editorial-quote-${quote.id}"`)).split('</div>')[0];
      expect(section).toContain(`data-quote-id="${quote.id}"`);
      expect(section).toContain(input.sources.find((source) => source.id === quote.sourceId)!.url);
      expect(section).toContain(`dateTime="${quote.retrievedAt}"`);
    }
    expect(html).toContain('FIXTURE &lt;条件&gt; を維持');
    expect(html).toContain(`dateTime="${input.verification.checkedAt}"`);
    expect(html).toContain('今回取得した資料の比較'); expect(html).toContain('公報集計・保存AI結果とは別');
    expect(html).toContain('dateTime="2024-02-29"'); expect(html).toContain('春予定');
    expect(html).not.toContain('元本文はこの環境に未保存'); expect(html).not.toContain('保存記録上の発表日');
    expect(input).toEqual(before);
  });

  it('reads the fixed local JSON once and never fetches the external citation URLs', async () => {
    const input = fixture(), fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(input)));
    expect(await loadEditorialComparison(input.companyName, fetcher)).toEqual(input);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/__signals-local-preview/approved/official-comparison.json', {
      method: 'GET', credentials: 'omit', cache: 'no-store', mode: 'same-origin', redirect: 'error',
    });
  });
});

function candidateFixture() {
  const data = fixture();
  data.version = 3;
  data.discovery = { productKind: 'FIXTURE-製品分野', selectionReason: '同じ取得回にある仕様を比較するため。', comparisonBasis: 'same_capture_products', previousCaptureAt: null };
  data.verification.quotes = data.verification.quotes.map((quote) => ({ ...quote, label: '仕様の原文' }));
  data.verification.quotes[2].label = '数値の原文';
  data.verification.quotes[4].label = '測定条件';
  return data;
}

describe('saved candidate metadata in private comparison v3', () => {
  it('keeps the original evidence exactly while validating the explicit candidate scope', () => {
    const input = candidateFixture(), before = structuredClone(input);
    expect(decodeEditorialComparison(input, input.companyName)).toEqual(before);
    expect(input).toEqual(before);
    const html = renderToStaticMarkup(createElement(SignalEditorialComparison, { comparison: input, summaryOnly: true }));
    expect(html).toContain('FIXTURE-製品分野'); expect(html).toContain('同じ取得回の製品間比較');
    expect(html).toContain('数値の原文'); expect(html).toContain('測定条件');
    expect(html).toContain('id="signal-editorial-cell-1-0"');
    expect(html).toContain('aria-label="FIXTURE-Alpha：準備時間 12秒"');
    expect(html).toContain('data-return-target="signal-editorial-cell-1-0"');
    for (const quote of input.verification.quotes) expect(html).toContain(`data-return-quote="${quote.id}"`);
  });

  it.each([
    ['missing discovery', (data: ReturnType<typeof candidateFixture>) => { Reflect.deleteProperty(data, 'discovery'); }],
    ['unrecorded scope field', (data: ReturnType<typeof candidateFixture>) => { Object.assign(data.discovery!, { watchId: 'kds_fixture_watch' }); }],
    ['empty product kind', (data: ReturnType<typeof candidateFixture>) => { data.discovery!.productKind = ' '; }],
    ['empty selection reason', (data: ReturnType<typeof candidateFixture>) => { data.discovery!.selectionReason = ''; }],
    ['invented historical basis', (data: ReturnType<typeof candidateFixture>) => { Object.assign(data.discovery!, { comparisonBasis: 'previous_capture' }); }],
    ['invented prior acquisition', (data: ReturnType<typeof candidateFixture>) => { Object.assign(data.discovery!, { previousCaptureAt: '2024-02-01T00:00:00Z' }); }],
    ['missing quote label', (data: ReturnType<typeof candidateFixture>) => { Reflect.deleteProperty(data.verification.quotes[0], 'label'); }],
    ['empty quote label', (data: ReturnType<typeof candidateFixture>) => { data.verification.quotes[0].label = ''; }],
    ['v3 metadata in v2', (data: ReturnType<typeof candidateFixture>) => { data.version = 2; }],
  ] as const)('rejects %s', (_label, mutate) => {
    const input = candidateFixture(); mutate(input);
    expect(() => decodeEditorialComparison(input, input.companyName)).toThrow(EditorialComparisonError);
  });
});

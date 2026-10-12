import { createElement, type MouseEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeEditorialComparison, EditorialComparisonError, loadEditorialComparison, localProductSummaryEnabled, type EditorialComparison } from './editorial-comparison';
import { SignalEditorialComparison } from './SignalEditorialComparison';
// @ts-expect-error The local-only JavaScript middleware has no declaration file.
import { approvedPreviewPlugin } from '../../scripts/approved-preview-middleware.mjs';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

function fixture(): EditorialComparison {
  return {
    version: 1, companyName: '架空製品研究所', title: '架空の製品寸法と質量を比べる',
    products: [{ label: 'FIXTURE-ALPHA' }, { label: 'FIXTURE-BETA' }],
    differences: [
      { label: '外形高さ', values: ['120 mm', '105 mm'], sourceIds: ['kds_fixture_SOURCE_A', 'kds_fixture_SOURCE_B'] },
      { label: '質量', values: ['250 g', '230 g'], sourceIds: ['kds_fixture_SOURCE_A', 'kds_fixture_SOURCE_B'] },
    ],
    condition: '架空の仕様表にある本体のみの値を比較。', whyItMatters: '寸法と質量を分け、使う場面との対応を検討できる。',
    nextQuestion: '使い方を変えずに外形を小さくした理由を確認できるか？',
    announcement: { publishedAt: '2024-02-29', releaseWindow: '春ごろ', sourceId: 'kds_fixture_SOURCE_B' },
    manufacturerClaim: { text: 'メーカー資料に試験条件を限定した比較値がある。', sourceId: 'kds_fixture_SOURCE_B' },
    limitations: ['寸法差の原因は未確認。', '正式な後継機種とは確認していない。'],
    sources: [
      { id: 'kds_fixture_SOURCE_A', label: '架空の旧製品仕様', url: 'https://example.test/products/fixture-alpha.html', notes: '外形高さと質量の記載。' },
      { id: 'kds_fixture_SOURCE_B', label: '架空の新製品発表', url: 'https://example.test/news/fixture-beta.html', notes: '発表日・発売時期・試験条件の記載。' },
    ],
  };
}

describe('separate editorial comparison boundary', () => {
  it('requires both explicit local flags and an exact loopback host', () => {
    for (const hostname of ['127.0.0.1', 'localhost', '[::1]']) expect(localProductSummaryEnabled('true', 'true', hostname)).toBe(true);
    for (const hostname of ['', 'signals.example.test', 'localhost.example.test', '127.0.0.2', '0.0.0.0']) expect(localProductSummaryEnabled('true', 'true', hostname)).toBe(false);
    for (const flag of [undefined, false, true, '', 'false', 'TRUE']) expect(localProductSummaryEnabled(flag, 'true', 'localhost')).toBe(false);
    expect(localProductSummaryEnabled('true', undefined, 'localhost')).toBe(false);
    expect(localProductSummaryEnabled('true', 'false', 'localhost')).toBe(false);
  });

  it('presents exact saved summary values and references without claiming the original text was rechecked', () => {
    const input = fixture(), before = structuredClone(input);
    const html = renderToStaticMarkup(createElement(SignalEditorialComparison, { comparison: input, summaryOnly: true }));
    expect(html).toContain('公式商品仕様の比較（保存済み要約）');
    expect(html).toContain('元本文はこの環境に未保存・原文再照合未実施');
    expect(html).toContain('公報集計・保存AI結果とは別');
    expect(html).toContain('保存記録上の発表日'); expect(html).toContain('保存記録上の発売時期');
    expect(html).toContain('保存記録にあるメーカーの比較試験');
    expect(html).toContain('以下の「確認」は保存時のメモ');
    expect(html).not.toContain('確認した原資料'); expect(html).not.toContain('発売時期（原資料の表記）');
    const initial = html.slice(0, html.indexOf('<details'));
    for (const product of input.products) expect(initial).toContain(product.label);
    for (const row of input.differences) for (const value of row.values) expect(initial).toContain(value);
    expect(initial).toContain(input.condition); expect(initial).toContain(input.whyItMatters);
    for (const source of input.sources) expect(initial).toContain(source.label);
    expect(input).toEqual(before);
  });

  it('preserves source values, exact company binding and the release wording without inventing a date or run', () => {
    const input = fixture(), saved = structuredClone(input);
    expect(decodeEditorialComparison(input, input.companyName)).toEqual(saved);
    expect(input).toEqual(saved);
    expect(decodeEditorialComparison(input, input.companyName).announcement.releaseWindow).toBe('春ごろ');
    for (const company of ['別の架空企業', `${input.companyName} `, '']) expect(() => decodeEditorialComparison(input, company)).toThrow(EditorialComparisonError);
  });

  it.each(['top', 'product', 'row', 'announcement', 'claim', 'source'])('rejects an extra %s field instead of joining another contract', (location) => {
    const input = fixture();
    const targets = { top: input, product: input.products[0], row: input.differences[0], announcement: input.announcement, claim: input.manufacturerClaim, source: input.sources[0] };
    Object.assign(targets[location as keyof typeof targets], { generatedAnswer: '架空の混入文' });
    expect(() => decodeEditorialComparison(input, input.companyName)).toThrow(EditorialComparisonError);
  });

  it.each(['version', 'one-product', 'same-products', 'three-values', 'missing-source', 'duplicate-source', 'duplicate-reference', 'unbound-row', 'unbound-date', 'unbound-claim', 'empty-condition', 'long-title', 'too-many-rows', 'no-limitations'])('rejects %s rather than repairing the comparison', (mutation) => {
    const input = fixture();
    if (mutation === 'version') Object.assign(input, { version: 2 });
    if (mutation === 'one-product') input.products.pop();
    if (mutation === 'same-products') input.products[1] = { ...input.products[0] };
    if (mutation === 'three-values') input.differences[0].values.push('架空の余分な値');
    if (mutation === 'missing-source') input.sources = [];
    if (mutation === 'duplicate-source') input.sources.push({ ...input.sources[0] });
    if (mutation === 'duplicate-reference') input.differences[0].sourceIds.push(input.differences[0].sourceIds[0]);
    if (mutation === 'unbound-row') input.differences[0].sourceIds = ['kds_fixture_MISSING'];
    if (mutation === 'unbound-date') input.announcement.sourceId = 'kds_fixture_MISSING';
    if (mutation === 'unbound-claim') input.manufacturerClaim.sourceId = 'kds_fixture_MISSING';
    if (mutation === 'empty-condition') input.condition = ' ';
    if (mutation === 'long-title') input.title = '架'.repeat(181);
    if (mutation === 'too-many-rows') input.differences = Array.from({ length: 7 }, () => input.differences[0]);
    if (mutation === 'no-limitations') input.limitations = [];
    expect(() => decodeEditorialComparison(input, input.companyName)).toThrow(EditorialComparisonError);
  });

  it.each(['2023-02-29', '2024-02-30', '2024-13-01', '2024-2-01', '2024-02-29T00:00:00Z', '0000-01-01'])('rejects invalid or ambiguous announcement date %s', (date) => {
    const input = fixture(); input.announcement.publishedAt = date;
    expect(() => decodeEditorialComparison(input, input.companyName)).toThrow(EditorialComparisonError);
  });

  it.each(['http://example.test/news', 'https://user:pass@example.test/news', 'https://example.test/news?key=fixture', 'https://example.test/news#fragment', 'https://localhost/news', 'https://service.local/news', 'https://127.0.0.1/news', 'https://[::1]/news', 'https://example.test:8443/news', 'https://example.test/api/analysis', 'https://example.test/%62ackend/record', 'https://example.test/news/../internal/record', 'https://example.test/__signals-local-preview/approved/preview.json', '/api/v1/runs', 'file:///fixture'])('rejects unsafe or backend source URL %s', (url) => {
    const input = fixture(); input.sources[0].url = url;
    expect(() => decodeEditorialComparison(input, input.companyName)).toThrow(EditorialComparisonError);
  });

  it('loads one fixed same-origin request without fetching the cited official pages', async () => {
    const input = fixture(), controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(input)));
    expect(await loadEditorialComparison(input.companyName, fetcher, controller.signal)).toEqual(input);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/__signals-local-preview/approved/official-comparison.json', {
      method: 'GET', credentials: 'omit', cache: 'no-store', mode: 'same-origin', redirect: 'error', signal: controller.signal,
    });
  });

  it('does not retry errors or fall back to a different company or live API', async () => {
    const unavailable = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(loadEditorialComparison('架空製品研究所', unavailable)).rejects.toThrow(EditorialComparisonError);
    expect(unavailable).toHaveBeenCalledTimes(1);
    const wrongCompany = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(fixture())));
    await expect(loadEditorialComparison('別の架空企業', wrongCompany)).rejects.toThrow(EditorialComparisonError);
    expect(wrongCompany).toHaveBeenCalledTimes(1);
    const cancelled = new DOMException('Fictional cancellation', 'AbortError');
    const aborted = vi.fn<typeof fetch>().mockRejectedValue(cancelled);
    await expect(loadEditorialComparison('架空製品研究所', aborted)).rejects.toBe(cancelled);
    expect(aborted).toHaveBeenCalledTimes(1);
  });

  it('shows the exact comparison and its limits without implying automated monitoring, independent proof or a mapped design', () => {
    const input = fixture(), before = structuredClone(input);
    const html = renderToStaticMarkup(createElement(SignalEditorialComparison, { comparison: input }));
    expect(html).toContain('公式資料から編集した実例 · 自動監視・実AIの結果ではありません');
    expect(html).toContain('この収録意匠・分類との対応は未確認');
    expect(html).toContain('メーカーの説明であり、独立した実証ではありません');
    expect(html).toContain('発売時期（原資料の表記）'); expect(html).toContain('春ごろ');
    expect(html).toContain('dateTime="2024-02-29"');
    for (const row of input.differences) for (const value of row.values) expect(html).toContain(value);
    for (const source of input.sources) {
      expect(html).toContain(`href="#signal-editorial-source-${source.id}"`);
      expect(html).toContain(`id="signal-editorial-source-${source.id}"`);
      expect(html).toContain(`href="${source.url}" target="_blank" rel="noopener noreferrer"`);
    }
    for (const limitation of input.limitations) expect(html).toContain(limitation);
    expect(html).toContain(input.nextQuestion); expect(html).not.toContain('分析を開始');
    expect(input).toEqual(before);
  });

  it('opens the closed source details and focuses the actual cited source from a table link', () => {
    class ElementStub {
      tagName: string;
      parentElement: ElementStub | null;
      open = false;
      attributes = new Map<string, string>();
      focus = vi.fn();
      scrollIntoView = vi.fn();
      constructor(tagName: string, parent: ElementStub | null = null) { this.tagName = tagName; this.parentElement = parent; }
      hasAttribute(key: string) { return this.attributes.has(key); }
      getAttribute(key: string) { return this.attributes.get(key) ?? null; }
      setAttribute(key: string, value: string) { this.attributes.set(key, value); }
      closest() { return this; }
    }
    vi.stubGlobal('Element', ElementStub);
    const root = new ElementStub('SECTION'), details = new ElementStub('DETAILS', root), source = new ElementStub('LI', details), link = new ElementStub('A', root);
    link.setAttribute('href', '#signal-editorial-source-kds_fixture_SOURCE_A');
    Object.assign(root, { contains: (target: ElementStub) => target === source, ownerDocument: { getElementById: (id: string) => id === 'signal-editorial-source-kds_fixture_SOURCE_A' ? source : null } });
    const preventDefault = vi.fn();
    const event = { defaultPrevented: false, button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, target: link, currentTarget: root, preventDefault } as unknown as MouseEvent<HTMLElement>;
    SignalEditorialComparison({ comparison: fixture() }).props.onClickCapture(event);
    expect(details.open).toBe(true); expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(source.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(source.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'start', behavior: 'auto' });
  });
});

type TestRequest = { url: string; method: string };
type TestResponse = { statusCode: number; setHeader: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
type Handler = (request: TestRequest, response: TestResponse, next: () => void) => Promise<void>;

async function invokeRoute(url: string, method = 'GET') {
  let handler: Handler | undefined;
  approvedPreviewPlugin().configureServer({ middlewares: { use: (value: Handler) => { handler = value; } } });
  if (!handler) throw new Error('Missing fictional server middleware');
  const response: TestResponse = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() }, next = vi.fn();
  await handler({ url, method }, response, next);
  return { response, next };
}

describe('fixed read-only editorial route', () => {
  beforeEach(() => vi.mocked(readFile).mockReset());
  it.each(['GET', 'HEAD'])('serves only the fixed private comparison file for %s', async (method) => {
    const json = Buffer.from(JSON.stringify(fixture()));
    vi.mocked(readFile).mockResolvedValue(json);
    const { response, next } = await invokeRoute('/__signals-local-preview/approved/official-comparison.json', method);
    expect(response.statusCode).toBe(200); expect(next).not.toHaveBeenCalled();
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(readFile).mock.calls[0][0])).toMatch(/\/approved-evidence-private\/official-comparison\.json$/);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.end).toHaveBeenCalledWith(method === 'HEAD' ? undefined : json);
  });
  it.each(['POST', 'PUT', 'DELETE'])('rejects %s before reading any file', async (method) => {
    const { response } = await invokeRoute('/__signals-local-preview/approved/official-comparison.json', method);
    expect(response.statusCode).toBe(405); expect(readFile).not.toHaveBeenCalled();
  });
  it('does not turn unrecognized or encoded media paths into filenames', async () => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({ media: [] })));
    for (const route of ['other.json', 'media/..%2Fofficial-comparison.json']) {
      const { response } = await invokeRoute(`/__signals-local-preview/approved/${route}`);
      expect(response.statusCode).toBe(404);
    }
    for (const [path] of vi.mocked(readFile).mock.calls) expect(String(path)).toMatch(/\/approved-evidence-private\/preview\.json$/);
  });
  it('reports a missing comparison without falling back to preview or live API', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('Fictional missing file'));
    const { response, next } = await invokeRoute('/__signals-local-preview/approved/official-comparison.json');
    expect(response.statusCode).toBe(503); expect(readFile).toHaveBeenCalledTimes(1); expect(next).not.toHaveBeenCalled();
  });
  it('preserves the original preview and digest-checked media routes', async () => {
    const image = Buffer.from('fictional image bytes');
    const json = Buffer.from(JSON.stringify({ media: [{ id: 'kds_fixture_MEDIA', file: 'a.jpg', sha256: createHash('sha256').update(image).digest('hex') }] }));
    vi.mocked(readFile).mockResolvedValueOnce(json);
    let result = await invokeRoute('/__signals-local-preview/approved/preview.json');
    expect(result.response.statusCode).toBe(200); expect(result.response.end).toHaveBeenCalledWith(json);
    for (const route of ['/__signals-local-preview/approved/media/kds_fixture_MEDIA', '/api/v1/media/kds_fixture_MEDIA']) {
      vi.mocked(readFile).mockResolvedValueOnce(json).mockResolvedValueOnce(image);
      result = await invokeRoute(route);
      expect(result.response.statusCode).toBe(200); expect(result.response.end).toHaveBeenCalledWith(image);
      expect(result.response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    }
  });
});

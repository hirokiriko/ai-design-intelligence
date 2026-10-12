import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  SAVED_OBSERVATIONS_PATH, SavedObservationsError, compareSavedSnapshots, decodeSavedObservations, loadSavedObservations,
  type SavedObservationArticle, type SavedObservationBundle, type SavedObservationCandidate, type SavedObservationSnapshot,
} from './saved-observations';

// Fictional material only. No saved real Run, company, article or observation is embedded.
const scope = { entityId: 'kds_fixture_company', categoryId: 'FIXTURE-CATEGORY' };
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
function candidate(suffix: string): SavedObservationCandidate {
  return { id: `kds_fixture_candidate_${suffix}`, title: `FIXTURE 記事 ${suffix}`,
    url: `https://fixture.example.test/news/FIXTURE-${suffix}`, publishedAt: null };
}
function article(suffix: string, retrievedAt: string): SavedObservationArticle {
  return { candidateId: candidate(suffix).id, title: candidate(suffix).title, url: candidate(suffix).url, retrievedAt,
    rawHash: digest('FIXTURE raw'), excerpt: 'FIXTURE 保存抜粋 😀', excerptHash: digest('FIXTURE 保存抜粋 😀'),
    body: null, bodyHash: null, bodyComplete: false, status: 'ok' };
}
function snapshot(side: 'before' | 'after'): SavedObservationSnapshot {
  const day = side === 'before' ? '01' : '02';
  return { id: `kds_fixture_snapshot_${side}`, observedAt: `2026-01-${day}T00:01:00Z`,
    conditionsHash: digest('FIXTURE stable conditions'), conditionsVerified: 'recorded',
    scopeLabel: 'FIXTURE 登録入口の保存範囲', sourceUrl: 'https://fixture.example.test/news/',
    extractionVersion: 'FIXTURE-extractor-1', complete: true, eligibleCount: 2, omittedCount: 0,
    candidates: [candidate('a'), candidate('b')], articles: [article('a', `2026-01-${day}T00:00:20Z`)] };
}
function bundle(): SavedObservationBundle {
  return { version: 1, ...scope, companyName: 'FIXTURE 架空企業', categoryLabel: 'FIXTURE 架空分野',
    comparisons: [{ id: 'kds_fixture_comparison', label: 'FIXTURE 保存観測の比較', before: snapshot('before'), after: snapshot('after') }] };
}
function fullBody(item: SavedObservationArticle, content: string): void {
  Object.assign(item, { body: content, bodyHash: digest(content), bodyComplete: true, excerpt: null, excerptHash: null });
}
const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json; charset=utf-8' } });

describe('saved observation comparison semantics', () => {
  it('distinguishes stable-ID additions, exits from the subset, metadata changes and identical candidates without mutation', async () => {
    const before = snapshot('before'), after = snapshot('after');
    before.candidates.push(candidate('c'), candidate('d'));
    after.candidates = [candidate('a'), { ...candidate('c'), title: 'FIXTURE 訂正された題名', publishedAt: '2026-01-01' }, candidate('d'), candidate('e')];
    before.eligibleCount = after.eligibleCount = 4;
    const original = structuredClone({ before, after });
    const compared = await compareSavedSnapshots(before, after);
    expect(compared.comparable).toBe(true);
    expect(compared.scopeComplete).toBe(true);
    expect(compared.candidates.added.map((item) => item.id)).toEqual([candidate('e').id]);
    expect(compared.candidates.removed.map((item) => item.id)).toEqual([candidate('b').id]);
    expect(compared.candidates.changed).toEqual([{ before: candidate('c'), after: after.candidates[1], fields: ['title', 'publishedAt'] }]);
    expect(compared.candidates.unchanged.map((item) => item.id)).toEqual([candidate('a').id, candidate('d').id]);
    expect({ before, after }).toEqual(original);
  });

  it('compares a counted partial subset without counting its omitted candidate as unchanged', async () => {
    const before = snapshot('before'), after = snapshot('after');
    for (const item of [before, after]) Object.assign(item, { complete: true, eligibleCount: 3, omittedCount: 1 });
    after.conditionsVerified = 'reconstructed';
    const compared = await compareSavedSnapshots(before, after);
    expect(compared.comparable).toBe(true);
    expect(compared.scopeComplete).toBe(false);
    expect(compared.conditionsVerified).toBe('reconstructed');
    expect(compared.candidates.unchanged).toHaveLength(2);
  });

  it('keeps full-body state unknown when equal excerpts have different raw HTML hashes', async () => {
    const before = snapshot('before'), after = snapshot('after');
    after.articles[0].rawHash = digest('FIXTURE different raw HTML');
    const [change] = (await compareSavedSnapshots(before, after)).articles;
    expect(change).toMatchObject({ bodyChange: 'unknown', excerptChange: 'unchanged', rawChange: 'changed' });
  });

  it('does not use a matching raw hash or a changed excerpt as a full-body comparison', async () => {
    const before = snapshot('before'), after = snapshot('after');
    after.articles[0].excerpt = 'FIXTURE 変更された抜粋';
    after.articles[0].excerptHash = digest(after.articles[0].excerpt);
    expect((await compareSavedSnapshots(before, after)).articles[0]).toMatchObject({
      bodyChange: 'unknown', excerptChange: 'changed', rawChange: 'unchanged',
    });
  });

  it.each(['changed', 'unchanged'] as const)('compares verified complete bodies as %s independently of raw HTML', async (expected) => {
    const before = snapshot('before'), after = snapshot('after');
    fullBody(before.articles[0], 'FIXTURE 完全な本文');
    fullBody(after.articles[0], expected === 'unchanged' ? 'FIXTURE 完全な本文' : 'FIXTURE 変更された完全な本文');
    after.articles[0].rawHash = digest('FIXTURE other raw');
    expect((await compareSavedSnapshots(before, after)).articles[0].bodyChange).toBe(expected);
  });

  it.each(['missing-before', 'missing-after', 'partial-body', 'reused-retrieval'] as const)('keeps %s body unknown', async (kind) => {
    const before = snapshot('before'), after = snapshot('after');
    fullBody(before.articles[0], 'FIXTURE 完全な本文');
    fullBody(after.articles[0], 'FIXTURE 完全な本文');
    if (kind === 'missing-before') before.articles = [];
    if (kind === 'missing-after') after.articles = [];
    if (kind === 'partial-body') after.articles[0].bodyComplete = false;
    if (kind === 'reused-retrieval') after.articles[0].retrievedAt = before.articles[0].retrievedAt;
    expect((await compareSavedSnapshots(before, after)).articles[0].bodyChange).toBe('unknown');
  });

  it.each(['conditions', 'extraction', 'source', 'incomplete', 'error'] as const)('does not compare %s observations', async (kind) => {
    const before = snapshot('before'), after = snapshot('after');
    if (kind === 'conditions') after.conditionsHash = digest('FIXTURE another condition');
    if (kind === 'extraction') after.extractionVersion = 'FIXTURE-extractor-2';
    if (kind === 'source') after.sourceUrl = 'https://fixture.example.test/other/';
    if (kind === 'incomplete') after.complete = false;
    if (kind === 'error') Object.assign(after.articles[0], { status: 'error', excerpt: null, excerptHash: null });
    const compared = await compareSavedSnapshots(before, after);
    expect(compared.comparable).toBe(false);
    expect(compared.scopeComplete).toBe(false);
    expect(compared.reason).not.toBeNull();
    expect(compared.candidates).toEqual({ added: [], removed: [], changed: [], unchanged: [] });
    expect(compared.articles).toEqual([]);
  });

  it('retains genuinely empty complete observations without inventing a change', async () => {
    const before = snapshot('before'), after = snapshot('after');
    for (const item of [before, after]) Object.assign(item, { candidates: [], articles: [], eligibleCount: 0 });
    const compared = await compareSavedSnapshots(before, after);
    expect(compared.comparable).toBe(true);
    expect(compared.candidates.unchanged).toEqual([]);
  });

  it('does not confuse an incomplete acquisition with a successfully saved bounded selection', async () => {
    const before = snapshot('before'), after = snapshot('after');
    Object.assign(after, { complete: false, eligibleCount: 3, omittedCount: 1 });
    expect(await compareSavedSnapshots(before, after)).toMatchObject({ comparable: false, reason: 'incomplete_snapshot', scopeComplete: false });
  });
});

describe('strict saved observation boundary', () => {
  it('decodes the exact selected scope with fresh containers and preserves the source object', async () => {
    const input = bundle(), preserved = structuredClone(input);
    const decoded = await decodeSavedObservations(input, scope);
    expect(decoded).toEqual(input);
    expect(decoded).not.toBe(input);
    expect(decoded.comparisons[0].before).not.toBe(input.comparisons[0].before);
    expect(input).toEqual(preserved);
  });

  it.each(['entityId', 'categoryId'] as const)('rejects a different %s scope', async (field) => {
    await expect(decodeSavedObservations(bundle(), { ...scope, [field]: 'FIXTURE-OTHER' })).rejects.toMatchObject({ code: 'scope_mismatch' });
  });

  it('rejects an empty comparison list instead of presenting a ready state with no observation pair', async () => {
    const input = bundle(); input.comparisons = [];
    await expect(decodeSavedObservations(input, scope)).rejects.toMatchObject({ code: 'invalid_data' });
  });

  it.each(['candidate-id', 'candidate-url', 'article-id', 'comparison-id'] as const)('rejects duplicate %s', async (kind) => {
    const input = bundle(), item = input.comparisons[0].after;
    if (kind === 'candidate-id') item.candidates[1].id = item.candidates[0].id;
    if (kind === 'candidate-url') item.candidates[1].url = item.candidates[0].url;
    if (kind === 'article-id') item.articles.push(structuredClone(item.articles[0]));
    if (kind === 'comparison-id') input.comparisons.push(structuredClone(input.comparisons[0]));
    await expect(decodeSavedObservations(input, scope)).rejects.toBeInstanceOf(SavedObservationsError);
  });

  it.each(['excerpt-hash', 'body-hash', 'malformed-hash', 'orphan-hash', 'missing-hash'] as const)('rejects %s without accepting a claimed digest', async (kind) => {
    const input = bundle(), item = input.comparisons[0].after.articles[0];
    if (kind === 'excerpt-hash') item.excerptHash = digest('FIXTURE another excerpt');
    if (kind === 'body-hash') { fullBody(item, 'FIXTURE body'); item.bodyHash = digest('FIXTURE another body'); }
    if (kind === 'malformed-hash') item.rawHash = 'a'.repeat(63);
    if (kind === 'orphan-hash') item.bodyHash = digest('FIXTURE missing body');
    if (kind === 'missing-hash') item.excerptHash = null;
    await expect(decodeSavedObservations(input, scope)).rejects.toBeInstanceOf(SavedObservationsError);
  });

  it.each(['equal', 'reverse', 'invalid-day', 'timezone-free', 'same-id', 'article-after-batch'] as const)('rejects %s observation chronology', async (kind) => {
    const input = bundle(), { before, after } = input.comparisons[0];
    if (kind === 'equal') before.observedAt = after.observedAt;
    if (kind === 'reverse') before.observedAt = '2026-01-03T00:00:00Z';
    if (kind === 'invalid-day') after.observedAt = '2026-02-30T00:00:00Z';
    if (kind === 'timezone-free') after.observedAt = '2026-01-02T00:01:00';
    if (kind === 'same-id') after.id = before.id;
    if (kind === 'article-after-batch') after.articles[0].retrievedAt = '2026-01-02T00:02:00Z';
    await expect(decodeSavedObservations(input, scope)).rejects.toBeInstanceOf(SavedObservationsError);
  });

  it('orders microsecond timestamps without collapsing them to the same millisecond', async () => {
    const before = snapshot('before'), after = snapshot('after');
    before.observedAt = '2026-01-02T00:01:00.123456Z';
    after.observedAt = '2026-01-02T00:01:00.123457Z';
    expect((await compareSavedSnapshots(before, after)).comparable).toBe(true);
  });

  it.each(['javascript:alert(1)', 'file:///FIXTURE.json', 'http://fixture.example.test/news/',
    'https://user:password@fixture.example.test/news/', 'https://127.0.0.1/news/', 'https://localhost/news/',
    'https://fixture.internal/news/', 'https://fixture.example.test/news/?token=FIXTURE',
    'https://fixture.example.test/news/#FIXTURE', 'https://fixture.example.test/news/%0aFIXTURE'])('rejects unsafe source URL %s', async (url) => {
    const input = bundle(); input.comparisons[0].before.sourceUrl = url;
    await expect(decodeSavedObservations(input, scope)).rejects.toBeInstanceOf(SavedObservationsError);
  });

  it.each(['unknown-article', 'wrong-article-url', 'counts', 'negative-omissions', 'full-body-missing', 'excerpt-outside-body', 'invalid-date', 'extra-key'] as const)('rejects inconsistent %s', async (kind) => {
    const input = bundle(), item = input.comparisons[0].after;
    if (kind === 'unknown-article') item.articles[0].candidateId = 'kds_fixture_absent';
    if (kind === 'wrong-article-url') item.articles[0].url = candidate('b').url;
    if (kind === 'counts') item.eligibleCount += 1;
    if (kind === 'negative-omissions') item.omittedCount = -1;
    if (kind === 'full-body-missing') item.articles[0].bodyComplete = true;
    if (kind === 'excerpt-outside-body') Object.assign(item.articles[0], { body: 'FIXTURE 別本文', bodyHash: digest('FIXTURE 別本文'), bodyComplete: true });
    if (kind === 'invalid-date') item.candidates[0].publishedAt = '2026-02-30';
    if (kind === 'extra-key') Object.assign(item, { analysis: 'FIXTURE forbidden' });
    await expect(decodeSavedObservations(input, scope)).rejects.toBeInstanceOf(SavedObservationsError);
  });

  it('also validates direct comparison inputs instead of assuming they came through the loader', async () => {
    const before = snapshot('before'), after = snapshot('after');
    after.articles[0].excerptHash = digest('FIXTURE tampered');
    await expect(compareSavedSnapshots(before, after)).rejects.toBeInstanceOf(SavedObservationsError);
  });

  it('rejects conflicting contents under a reused snapshot ID across comparisons', async () => {
    const input = bundle(), second = structuredClone(input.comparisons[0]);
    second.id = 'kds_fixture_second_comparison';
    second.after.scopeLabel = 'FIXTURE conflicting retained scope';
    input.comparisons.push(second);
    await expect(decodeSavedObservations(input, scope)).rejects.toBeInstanceOf(SavedObservationsError);
  });
});

describe('loopback-only saved observation loader', () => {
  it('performs one fixed local GET with no credentials, caching, redirects or fallback', async () => {
    const input = bundle(), fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(input));
    const controller = new AbortController();
    expect(await loadSavedObservations(scope, { fetcher, signal: controller.signal, origin: 'http://127.0.0.1:4188' })).toEqual(input);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(SAVED_OBSERVATIONS_PATH, {
      method: 'GET', credentials: 'omit', cache: 'no-store', mode: 'same-origin', redirect: 'error', signal: controller.signal,
    });
  });

  it.each(['https://fixture.example.test', 'http://127.0.0.1.example.test', 'file://', 'http://user@localhost:4188', 'http://localhost:4188/path'])('blocks origin %s before fetching', async (origin) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(loadSavedObservations(scope, { fetcher, origin })).rejects.toMatchObject({ code: 'local_only' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['http', 'redirect', 'response-url', 'content-type', 'json', 'size'] as const)('rejects a %s response with no retry', async (kind) => {
    let result = response(bundle());
    if (kind === 'http') result = new Response(null, { status: 404 });
    if (kind === 'redirect') Object.defineProperty(result, 'redirected', { value: true });
    if (kind === 'response-url') Object.defineProperty(result, 'url', { value: 'https://fixture.example.test/elsewhere' });
    if (kind === 'content-type') result.headers.set('content-type', 'text/html');
    if (kind === 'json') result = new Response('{', { headers: { 'content-type': 'application/json' } });
    if (kind === 'size') result.headers.set('content-length', String(3 * 1024 * 1024));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(result);
    await expect(loadSavedObservations(scope, { fetcher, origin: 'http://localhost:4188' })).rejects.toMatchObject({ code: 'load_failed' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not return another entity bundle or retry to acquire the requested scope', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(bundle()));
    await expect(loadSavedObservations({ ...scope, entityId: 'kds_fixture_other_company' }, { fetcher, origin: 'http://127.0.0.1:4188' }))
      .rejects.toMatchObject({ code: 'scope_mismatch' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('preserves cancellation without attempting another request', async () => {
    const abort = new DOMException('FIXTURE cancelled', 'AbortError');
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(abort);
    await expect(loadSavedObservations(scope, { fetcher, origin: 'http://127.0.0.1:4188' })).rejects.toBe(abort);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

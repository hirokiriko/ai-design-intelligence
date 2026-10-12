// Private loopback preview data. This is separate from the saved Run/API contract.
export const SAVED_OBSERVATIONS_PATH = '/__local/saved-observations.json';
const MAX_BYTES = 2 * 1024 * 1024;

export interface SavedObservationCandidate {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
}
export interface SavedObservationArticle {
  candidateId: string;
  title: string;
  url: string;
  retrievedAt: string;
  rawHash: string | null;
  excerpt: string | null;
  excerptHash: string | null;
  body: string | null;
  bodyHash: string | null;
  bodyComplete: boolean;
  status: 'ok' | 'error';
}
export interface SavedObservationSnapshot {
  id: string;
  // End of the acquisition batch; every article retrieval is at or before this instant.
  observedAt: string;
  conditionsHash: string;
  conditionsVerified: 'recorded' | 'reconstructed';
  scopeLabel: string;
  sourceUrl: string;
  extractionVersion: string;
  // Acquisition finished successfully; a completed bounded selection may still omit candidates.
  complete: boolean;
  eligibleCount: number;
  omittedCount: number;
  candidates: SavedObservationCandidate[];
  articles: SavedObservationArticle[];
}
export interface SavedObservationScope { entityId: string; categoryId: string }
export interface SavedObservationComparison {
  id: string;
  label: string;
  before: SavedObservationSnapshot;
  after: SavedObservationSnapshot;
}
export interface SavedObservationBundle extends SavedObservationScope {
  version: 1;
  companyName: string;
  categoryLabel: string;
  comparisons: SavedObservationComparison[];
}
export type ObservationChange = 'changed' | 'unchanged' | 'unknown';
export type CandidateMetadataField = 'title' | 'url' | 'publishedAt';
export type ObservationComparisonReason = 'conditions_mismatch' | 'extraction_mismatch' | 'source_mismatch'
  | 'incomplete_snapshot' | 'article_fetch_failed';
export interface SavedObservationComparisonResult {
  comparable: boolean;
  reason: ObservationComparisonReason | null;
  scopeComplete: boolean;
  conditionsVerified: 'recorded' | 'reconstructed';
  before: SavedObservationSnapshot;
  after: SavedObservationSnapshot;
  candidates: {
    added: SavedObservationCandidate[];
    // Missing from the saved subset, not proof of removal from the source site.
    removed: SavedObservationCandidate[];
    changed: { before: SavedObservationCandidate; after: SavedObservationCandidate; fields: CandidateMetadataField[] }[];
    unchanged: SavedObservationCandidate[];
  };
  articles: {
    candidateId: string;
    before: SavedObservationArticle | null;
    after: SavedObservationArticle | null;
    bodyChange: ObservationChange;
    excerptChange: ObservationChange;
    rawChange: ObservationChange;
  }[];
}
export type ComparisonResult = SavedObservationComparisonResult;

export class SavedObservationsError extends Error {
  constructor(public readonly code: 'invalid_data' | 'scope_mismatch' | 'local_only' | 'load_failed' = 'invalid_data') {
    super('保存観測の出典・条件を確認できません。新しい取得や分析は開始していません。');
    this.name = 'SavedObservationsError';
  }
}
function fail(code?: SavedObservationsError['code']): never { throw new SavedObservationsError(code); }
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(item, key))) return fail();
  return item;
}
function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit
    || Array.from(value).some((character) => {
      const code = character.codePointAt(0)!;
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
    })) return fail();
  return value;
}
function id(value: unknown): string {
  const result = text(value, 200);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(result)) return fail();
  return result;
}
function hash(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) return fail();
  return value;
}
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') return fail(); return value; }
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 100_000) return fail();
  return value;
}
function publicUrl(value: unknown): string {
  const result = text(value, 2048);
  if (/[\s\\]/.test(result) || /%(?:00|0a|0d|5c)/i.test(result)) return fail();
  let url: URL;
  try { url = new URL(result); } catch { return fail(); }
  const host = url.hostname;
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
    || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(host)
    || /(?:^|\.)(?:localhost|local|internal)$/.test(host) || result !== url.href) return fail();
  return result;
}
// UTC and fractional seconds are checked without Date's millisecond rounding.
function instant(value: unknown): bigint {
  if (typeof value !== 'string') return fail();
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!match) return fail();
  const milliseconds = Date.parse(`${match[1]}Z`);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 19) !== match[1]) return fail();
  return BigInt(milliseconds) * 1_000_000n + BigInt((match[2] ?? '').padEnd(9, '0'));
}
function date(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail();
  instant(`${value}T00:00:00Z`);
  return value;
}
async function digestPair(value: unknown, claimedHash: unknown, maximum: number): Promise<[string | null, string | null]> {
  if (value === null && claimedHash === null) return [null, null];
  const content = text(value, maximum);
  const expected = hash(claimedHash);
  if (!globalThis.crypto?.subtle) return fail();
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  const actual = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== expected) return fail();
  return [content, expected];
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return fail();
  return value;
}
function unique(values: string[]): void { if (new Set(values).size !== values.length) fail(); }

async function snapshot(value: unknown): Promise<SavedObservationSnapshot> {
  const data = object(value, ['id', 'observedAt', 'conditionsHash', 'conditionsVerified', 'scopeLabel', 'sourceUrl',
    'extractionVersion', 'complete', 'eligibleCount', 'omittedCount', 'candidates', 'articles']);
  const observedAt = text(data.observedAt, 40);
  const observedInstant = instant(observedAt);
  if (data.conditionsVerified !== 'recorded' && data.conditionsVerified !== 'reconstructed') return fail();
  const candidates = array(data.candidates, 2000).map((value): SavedObservationCandidate => {
    const item = object(value, ['id', 'title', 'url', 'publishedAt']);
    return { id: id(item.id), title: text(item.title, 1000), url: publicUrl(item.url), publishedAt: date(item.publishedAt) };
  });
  unique(candidates.map((item) => item.id));
  unique(candidates.map((item) => item.url));
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const eligibleCount = count(data.eligibleCount);
  const omittedCount = count(data.omittedCount);
  const complete = boolean(data.complete);
  if (eligibleCount !== candidates.length + omittedCount) return fail();
  const articles = await Promise.all(array(data.articles, 2000).map(async (value): Promise<SavedObservationArticle> => {
    const item = object(value, ['candidateId', 'title', 'url', 'retrievedAt', 'rawHash', 'excerpt', 'excerptHash',
      'body', 'bodyHash', 'bodyComplete', 'status']);
    const candidateId = id(item.candidateId);
    const url = publicUrl(item.url);
    if (byId.get(candidateId)?.url !== url || (item.status !== 'ok' && item.status !== 'error')) return fail();
    const retrievedAt = text(item.retrievedAt, 40);
    if (instant(retrievedAt) > observedInstant) return fail();
    const [excerpt, excerptHash] = await digestPair(item.excerpt, item.excerptHash, 30_000);
    const [body, bodyHash] = await digestPair(item.body, item.bodyHash, 200_000);
    const bodyComplete = boolean(item.bodyComplete);
    if ((bodyComplete && body === null) || (item.status === 'error' && (body !== null || excerpt !== null || bodyComplete))) return fail();
    if (bodyComplete && excerpt !== null && !body!.includes(excerpt)) return fail();
    return { candidateId, title: text(item.title, 1000), url, retrievedAt, rawHash: item.rawHash === null ? null : hash(item.rawHash),
      excerpt, excerptHash, body, bodyHash, bodyComplete, status: item.status };
  }));
  unique(articles.map((item) => item.candidateId));
  return { id: id(data.id), observedAt, conditionsHash: hash(data.conditionsHash), conditionsVerified: data.conditionsVerified,
    scopeLabel: text(data.scopeLabel, 1000), sourceUrl: publicUrl(data.sourceUrl), extractionVersion: text(data.extractionVersion, 100),
    complete, eligibleCount, omittedCount, candidates, articles };
}
function chronological(before: SavedObservationSnapshot, after: SavedObservationSnapshot): void {
  if (before.id === after.id || instant(before.observedAt) >= instant(after.observedAt)) fail();
}
function scope(value: SavedObservationScope): SavedObservationScope {
  const data = object(value, ['entityId', 'categoryId']);
  return { entityId: id(data.entityId), categoryId: id(data.categoryId) };
}

export async function decodeSavedObservations(value: unknown, expected: SavedObservationScope): Promise<SavedObservationBundle> {
  const expectedScope = scope(expected);
  const data = object(value, ['version', 'entityId', 'categoryId', 'companyName', 'categoryLabel', 'comparisons']);
  if (data.version !== 1) return fail();
  const entityId = id(data.entityId), categoryId = id(data.categoryId);
  if (entityId !== expectedScope.entityId || categoryId !== expectedScope.categoryId) return fail('scope_mismatch');
  const comparisonInputs = array(data.comparisons, 20);
  if (comparisonInputs.length === 0) return fail();
  const comparisons = await Promise.all(comparisonInputs.map(async (value): Promise<SavedObservationComparison> => {
    const item = object(value, ['id', 'label', 'before', 'after']);
    const [before, after] = await Promise.all([snapshot(item.before), snapshot(item.after)]);
    chronological(before, after);
    return { id: id(item.id), label: text(item.label, 1000), before, after };
  }));
  unique(comparisons.map((item) => item.id));
  // Reused snapshots must not give the same stable ID contradictory contents.
  const seen = new Map<string, string>();
  for (const comparison of comparisons) for (const item of [comparison.before, comparison.after]) {
    const payload = JSON.stringify(item);
    if (seen.has(item.id) && seen.get(item.id) !== payload) return fail();
    seen.set(item.id, payload);
  }
  return { version: 1, entityId, categoryId, companyName: text(data.companyName, 300), categoryLabel: text(data.categoryLabel, 300), comparisons };
}

// Pure comparison: validates its own inputs, performs no fetch, and never mutates them.
export async function compareSavedSnapshots(beforeValue: SavedObservationSnapshot, afterValue: SavedObservationSnapshot): Promise<ComparisonResult> {
  const [before, after] = await Promise.all([snapshot(beforeValue), snapshot(afterValue)]);
  chronological(before, after);
  const reason: ObservationComparisonReason | null = before.conditionsHash !== after.conditionsHash ? 'conditions_mismatch'
    : before.extractionVersion !== after.extractionVersion ? 'extraction_mismatch'
      : before.sourceUrl !== after.sourceUrl ? 'source_mismatch'
        : [before, after].some((item) => !item.complete) ? 'incomplete_snapshot'
          : [...before.articles, ...after.articles].some((item) => item.status === 'error') ? 'article_fetch_failed' : null;
  const result: ComparisonResult = {
    comparable: reason === null, reason,
    scopeComplete: reason === null && before.complete && after.complete && before.omittedCount === 0 && after.omittedCount === 0,
    conditionsVerified: before.conditionsVerified === 'recorded' && after.conditionsVerified === 'recorded' ? 'recorded' : 'reconstructed',
    before, after, candidates: { added: [], removed: [], changed: [], unchanged: [] }, articles: [],
  };
  if (reason) return result;
  const prior = new Map(before.candidates.map((candidate) => [candidate.id, candidate]));
  const current = new Map(after.candidates.map((candidate) => [candidate.id, candidate]));
  for (const candidate of after.candidates) {
    const old = prior.get(candidate.id);
    if (!old) result.candidates.added.push(candidate);
    else {
      const fields = (['title', 'url', 'publishedAt'] as const).filter((field) => old[field] !== candidate[field]);
      if (fields.length) result.candidates.changed.push({ before: old, after: candidate, fields });
      else result.candidates.unchanged.push(candidate);
    }
  }
  result.candidates.removed = before.candidates.filter((candidate) => !current.has(candidate.id));
  const priorArticles = new Map(before.articles.map((article) => [article.candidateId, article]));
  const currentArticles = new Map(after.articles.map((article) => [article.candidateId, article]));
  const articleIds = [...new Set([...after.articles, ...before.articles].map((article) => article.candidateId))];
  for (const candidateId of articleIds) {
    const old = priorArticles.get(candidateId) ?? null, article = currentArticles.get(candidateId) ?? null;
    const freshPair = old !== null && article !== null && old.url === article.url && instant(old.retrievedAt) < instant(article.retrievedAt);
    const change = (left: string | null | undefined, right: string | null | undefined): ObservationChange =>
      !freshPair || left == null || right == null ? 'unknown' : left === right ? 'unchanged' : 'changed';
    result.articles.push({ candidateId, before: old, after: article,
      bodyChange: old?.bodyComplete && article?.bodyComplete ? change(old.body, article.body) : 'unknown',
      excerptChange: change(old?.excerpt, article?.excerpt), rawChange: change(old?.rawHash, article?.rawHash) });
  }
  return result;
}

export interface SavedObservationLoadOptions { fetcher?: typeof fetch; signal?: AbortSignal; origin?: string }
export async function loadSavedObservations(expected: SavedObservationScope, options: SavedObservationLoadOptions = {}): Promise<SavedObservationBundle> {
  scope(expected);
  const origin = options.origin ?? globalThis.location?.origin;
  let location: URL;
  try { location = new URL(origin ?? ''); } catch { return fail('local_only'); }
  if (!['http:', 'https:'].includes(location.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)
    || location.username || location.password || location.origin !== origin) return fail('local_only');
  const response = await (options.fetcher ?? fetch)(SAVED_OBSERVATIONS_PATH, {
    method: 'GET', credentials: 'omit', cache: 'no-store', mode: 'same-origin', redirect: 'error',
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!response.ok || response.redirected || (response.url && response.url !== `${origin}${SAVED_OBSERVATIONS_PATH}`)
    || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) return fail('load_failed');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) return fail('load_failed');
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BYTES) return fail('load_failed');
  let value: unknown;
  try { value = JSON.parse(body); } catch { return fail('load_failed'); }
  return decodeSavedObservations(value, expected);
}

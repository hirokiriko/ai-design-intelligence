import { APPROVED_PREVIEW_BASE_PATH } from './approved-preview';

export interface EditorialComparison {
  version: 1;
  companyName: string;
  title: string;
  products: [{ label: string }, { label: string }];
  differences: { label: string; values: [string, string]; sourceIds: string[] }[];
  condition: string;
  whyItMatters: string;
  nextQuestion: string;
  announcement: { publishedAt: string; releaseWindow: string; sourceId: string };
  manufacturerClaim: { text: string; sourceId: string };
  limitations: string[];
  sources: { id: string; label: string; url: string; notes: string }[];
}

export class EditorialComparisonError extends Error {
  constructor() { super('公式資料の比較例を確認できません。保存された意匠の閲覧は続けられます。'); }
}
const fail = (): never => { throw new EditorialComparisonError(); };
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(item, key))) return fail();
  return item;
}
function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > limit
    || Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return fail();
  return value;
}
function list(value: unknown, minimum: number, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return fail();
  return value;
}
function sourceUrl(value: unknown): string {
  const raw = text(value, 1200);
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const path = decodeURIComponent(url.pathname);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port
      || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(host) || /^[\d.]+$/.test(host)
      || /(?:^|\.)(?:localhost|local|internal|testlocal)$/.test(host)
      || /(?:^|\/)(?:api|backend|internal|secrets?|credentials?|tokens?|__signals[^/]*)(?:\/|$)/i.test(path)
      || raw.includes('\\') || /(?:^|\/)\.\.(?:\/|$)/.test(decodeURIComponent(raw))) return fail();
    return raw;
  } catch { return fail(); }
}
function publishedDate(value: unknown): string {
  const date = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000')) return fail();
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return fail();
  return date;
}

// 別の編集資料として検証する。保存Run・AI評価・収録件数へ結合しない。
export function decodeEditorialComparison(value: unknown, companyName: string): EditorialComparison {
  const item = record(value, ['version', 'companyName', 'title', 'products', 'differences', 'condition', 'whyItMatters', 'nextQuestion', 'announcement', 'manufacturerClaim', 'limitations', 'sources']);
  if (item.version !== 1 || text(item.companyName, 160) !== text(companyName, 160)) return fail();
  const sources = list(item.sources, 1, 6).map((value) => {
    const source = record(value, ['id', 'label', 'url', 'notes']);
    const id = text(source.id, 80);
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) return fail();
    return { id, label: text(source.label, 160), url: sourceUrl(source.url), notes: text(source.notes, 800) };
  });
  const sourceIds = new Set(sources.map(({ id }) => id));
  if (sourceIds.size !== sources.length) return fail();
  const reference = (value: unknown): string => {
    if (typeof value !== 'string' || !sourceIds.has(value)) return fail();
    return value;
  };
  const products = list(item.products, 2, 2).map((value) => ({ label: text(record(value, ['label']).label, 120) })) as EditorialComparison['products'];
  if (products[0].label === products[1].label) return fail();
  const differences = list(item.differences, 1, 6).map((value) => {
    const row = record(value, ['label', 'values', 'sourceIds']);
    const ids = list(row.sourceIds, 1, sources.length).map(reference);
    if (new Set(ids).size !== ids.length) return fail();
    return { label: text(row.label, 100), values: list(row.values, 2, 2).map((value) => text(value, 200)) as [string, string], sourceIds: ids };
  });
  const announcement = record(item.announcement, ['publishedAt', 'releaseWindow', 'sourceId']);
  const claim = record(item.manufacturerClaim, ['text', 'sourceId']);
  return {
    version: 1, companyName, title: text(item.title, 180), products, differences,
    condition: text(item.condition, 500), whyItMatters: text(item.whyItMatters, 500), nextQuestion: text(item.nextQuestion, 300),
    announcement: { publishedAt: publishedDate(announcement.publishedAt), releaseWindow: text(announcement.releaseWindow, 100), sourceId: reference(announcement.sourceId) },
    manufacturerClaim: { text: text(claim.text, 600), sourceId: reference(claim.sourceId) },
    limitations: list(item.limitations, 1, 6).map((value) => text(value, 500)), sources,
  };
}

// 同一originの固定GET一回だけ。原資料URLは明示的なリンク操作まで取得しない。
export async function loadEditorialComparison(companyName: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<EditorialComparison> {
  text(companyName, 160);
  const response = await fetcher(`${APPROVED_PREVIEW_BASE_PATH}official-comparison.json`, {
    method: 'GET', credentials: 'omit', cache: 'no-store', mode: 'same-origin', redirect: 'error',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok || response.redirected) return fail();
  return decodeEditorialComparison(await response.json(), companyName);
}

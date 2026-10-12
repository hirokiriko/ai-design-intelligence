import { decodeRun, type RunV23 } from './contract';

export const APPROVED_PREVIEW_BASE_PATH = '/__signals-local-preview/approved/';

export interface ApprovedPreviewMedia {
  id: string; file: 'a.jpg' | 'b.jpg'; sha256: string; width: number; height: number;
}
export interface ApprovedPreview {
  version: 1;
  run: RunV23;
  quality: { v2: 'FAIL'; v4: 'FAIL'; humanAcceptance: 'NOT_PERFORMED' };
  observations: { id: string; text: string; mediaIds: string[] }[];
  media: [ApprovedPreviewMedia, ApprovedPreviewMedia];
  provenance: { savedRunSha256: string; qualityReviewSha256: string };
}

export class ApprovedPreviewError extends Error {
  constructor() { super('保存済み実結果の参照情報を確認できません。再生を停止しました。新しい分析は開始していません。'); }
}
const fail = (): never => { throw new ApprovedPreviewError(); };
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(result, key))) return fail();
  return result;
}
function boundedText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && Array.from(value).length <= limit;
}
function sha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

// この境界は私有の再生メタデータを検証する。Run DTOや保存時の引用・日時は書き換えない。
// 記載されたhashの形式と対応を確認する。元ファイル／画像のhash計測は搬入側の別検証。
export function decodeApprovedPreview(value: unknown): ApprovedPreview {
  const preview = record(value, ['version', 'run', 'quality', 'observations', 'media', 'provenance']);
  if (preview.version !== 1) return fail();
  const quality = record(preview.quality, ['v2', 'v4', 'humanAcceptance']);
  if (quality.v2 !== 'FAIL' || quality.v4 !== 'FAIL' || quality.humanAcceptance !== 'NOT_PERFORMED') return fail();
  const provenance = record(preview.provenance, ['savedRunSha256', 'qualityReviewSha256']);
  if (!sha256(provenance.savedRunSha256) || !sha256(provenance.qualityReviewSha256)) return fail();

  // decodeRunは引用のcodepoint offset、根拠ID、図面と比較組の一致を検証する。
  const run = decodeRun(preview.run);
  if (run.schemaVersion !== '2.3.0' || run.input.context.dataMode !== 'approved_public'
    || run.status === 'running' || !run.completedAt || !run.signal || !run.input.comparisonPair) return fail();
  const comparisonMedia = run.input.comparisonPair.media;
  if (!Array.isArray(preview.media) || preview.media.length !== 2 || run.signal.media.length !== 2) return fail();
  const media = preview.media.map((value, index) => {
    const item = record(value, ['id', 'file', 'sha256', 'width', 'height']);
    const expected = comparisonMedia[index];
    if (item.id !== expected.id || item.file !== (index === 0 ? 'a.jpg' : 'b.jpg') || !sha256(item.sha256)
      || !Number.isSafeInteger(item.width) || !Number.isSafeInteger(item.height)
      || item.width !== expected.width || item.height !== expected.height) return fail();
    return item as unknown as ApprovedPreviewMedia;
  }) as [ApprovedPreviewMedia, ApprovedPreviewMedia];
  const mediaIds = new Set(media.map((item) => item.id));
  if (mediaIds.size !== 2) return fail();

  if (!Array.isArray(preview.observations) || preview.observations.length > 20) return fail();
  const observationIds = new Set<string>();
  const observations = preview.observations.map((value) => {
    const item = record(value, ['id', 'text', 'mediaIds']);
    if (typeof item.id !== 'string' || !/^observation-[A-Za-z0-9_-]{1,80}$/.test(item.id)
      || observationIds.has(item.id) || !boundedText(item.text, 1500) || !Array.isArray(item.mediaIds)
      || item.mediaIds.length < 1 || item.mediaIds.length > 2 || new Set(item.mediaIds).size !== item.mediaIds.length
      || item.mediaIds.some((id) => typeof id !== 'string' || !mediaIds.has(id))) return fail();
    observationIds.add(item.id);
    return item as unknown as ApprovedPreview['observations'][number];
  });
  return { version: 1, run, quality: quality as unknown as ApprovedPreview['quality'], observations, media,
    provenance: provenance as unknown as ApprovedPreview['provenance'] };
}

// 固定の同一origin GETだけ。外部遷移、認証情報、保存、分析受付、再試行は行わない。
export async function loadApprovedPreview(fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<ApprovedPreview> {
  const response = await fetcher(`${APPROVED_PREVIEW_BASE_PATH}preview.json`, {
    method: 'GET', credentials: 'omit', cache: 'no-store', mode: 'same-origin', redirect: 'error',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok || response.redirected) return fail();
  return decodeApprovedPreview(await response.json());
}

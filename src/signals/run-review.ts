import { ContractError, type Run } from './contract';

export type ReviewCheck = 'V1' | 'V2' | 'V3' | 'V4' | 'V5';
export interface PublicRunReview {
  runId: string; schemaVersion: Run['schemaVersion']; promptVersion: string; modelId: string;
  reviewReference: string; reviewedAt: string | null; failedChecks: ReviewCheck[];
  ownerAcceptance: 'NOT_PERFORMED' | 'ACCEPTED' | 'REJECTED';
}
export type RunReviewState = { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; review: PublicRunReview | null };
export type RunReviews = Readonly<Record<string, RunReviewState>>;
type ReviewSubject = Pick<Run, 'id' | 'schemaVersion' | 'versions'>;

export function runReviewKey(run: ReviewSubject): string {
  return JSON.stringify([run.id, run.schemaVersion, run.versions.prompt, run.versions.model]);
}
export function reviewMatchesRun(review: PublicRunReview, run: ReviewSubject): boolean {
  return review.runId === run.id && review.schemaVersion === run.schemaVersion
    && review.promptVersion === run.versions.prompt && review.modelId === run.versions.model;
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new ContractError();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(result, key))) throw new ContractError();
  return result;
}
function utcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?Z$/.exec(value);
  if (!match || Number(match[1]) < 1) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3])
    && date.getUTCHours() === Number(match[4]) && date.getUTCMinutes() === Number(match[5]) && date.getUTCSeconds() === Number(match[6]);
}
export function decodeRunReview(value: unknown, run: ReviewSubject): PublicRunReview | null {
  const envelope = object(value, ['schemaVersion', 'runId', 'review']);
  if (envelope.schemaVersion !== '1.0.0' || envelope.runId !== run.id) throw new ContractError();
  if (envelope.review === null) return null;
  const review = object(envelope.review, ['runId', 'schemaVersion', 'promptVersion', 'modelId', 'reviewReference', 'reviewedAt', 'failedChecks', 'ownerAcceptance']);
  if (review.runId !== run.id || review.schemaVersion !== run.schemaVersion
    || review.promptVersion !== run.versions.prompt || review.modelId !== run.versions.model
    || typeof review.reviewReference !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(review.reviewReference)
    || (review.reviewedAt !== null && !utcTimestamp(review.reviewedAt))
    || !Array.isArray(review.failedChecks) || review.failedChecks.length > 5
    || review.failedChecks.some((check) => !['V1', 'V2', 'V3', 'V4', 'V5'].includes(check))
    || new Set(review.failedChecks).size !== review.failedChecks.length
    || typeof review.ownerAcceptance !== 'string' || !['NOT_PERFORMED', 'ACCEPTED', 'REJECTED'].includes(review.ownerAcceptance)) throw new ContractError();
  return {
    runId: run.id, schemaVersion: run.schemaVersion, promptVersion: run.versions.prompt, modelId: run.versions.model,
    reviewReference: review.reviewReference, reviewedAt: review.reviewedAt as string | null,
    failedChecks: [...review.failedChecks] as ReviewCheck[], ownerAcceptance: review.ownerAcceptance as PublicRunReview['ownerAcceptance'],
  };
}

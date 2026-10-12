import { createContext } from 'react';
import type { Run, Signal } from './contract';
import { reviewMatchesRun, runReviewKey, type ReviewCheck, type RunReviewState } from './run-review';

// 保存済みpreviewの品質を同じrunへ束縛する表示専用入力。APIレビュー記録は合成しない。
export interface ArchivedResultQuality {
  subjectKey: string;
  failedChecks: readonly ReviewCheck[];
}
export const ResultQualityContext = createContext<readonly ReviewCheck[]>([]);

export function knownFailedChecks(run: Run, state?: RunReviewState, archived?: ArchivedResultQuality): readonly ReviewCheck[] {
  const review = state?.status === 'ready' ? state.review : null;
  return [...new Set([
    ...(review && reviewMatchesRun(review, run) ? review.failedChecks : []),
    ...(archived?.subjectKey === runReviewKey(run) ? archived.failedChecks : []),
  ])];
}

// run単位の未達は個々の記述の誤りを断定しない。未達の前提を使う結論の採用を保留する。
export function claimFailedChecks(checks: readonly ReviewCheck[], signal: Signal, evidenceIds: readonly string[]): ReviewCheck[] {
  const result: ReviewCheck[] = [];
  if (checks.includes('V2') && signal.visualObservations.some((item) => evidenceIds.includes(item.id))) result.push('V2');
  if (checks.includes('V4')) result.push('V4');
  return result;
}

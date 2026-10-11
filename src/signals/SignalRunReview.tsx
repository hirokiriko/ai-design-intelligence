import type { Run } from './contract';
import { reviewMatchesRun, type RunReviewState } from './run-review';

export function SignalRunReview({ run, state, compact = false }: { run: Run; state?: RunReviewState; compact?: boolean }) {
  const review = state?.status === 'ready' ? state.review : null;
  const mismatch = review !== null && !reviewMatchesRun(review, run);
  const unavailable = state?.status === 'unavailable' || mismatch;
  const quality = unavailable ? '品質レビュー：確認できません' : state?.status === 'loading' ? '品質レビュー：確認中'
    : state?.status !== 'ready' ? '品質レビュー：未確認（結果を開いて確認）'
    : review === null ? '品質レビュー：未記録' : review.failedChecks.length
      ? `品質未達：${review.failedChecks.map((check) => `${check} FAIL`).join(' / ')}` : '登録された未達指摘なし';
  const owner = review !== null && !mismatch ? review.ownerAcceptance === 'NOT_PERFORMED' ? '本人受入：未実施'
    : review.ownerAcceptance === 'ACCEPTED' ? '本人受入：受入記録あり' : '本人受入：未受入' : null;
  if (compact) return <span className="signal-history-review"><span>{quality}</span>{owner ? <span>{owner}</span> : null}</span>;
  return <section className="signal-mode-note" aria-label="保存結果の品質レビュー">
    <p><strong>{quality}</strong>{owner ? <><br />{owner}</> : null}</p>
    <p className="signal-subtle">処理の終了は、V1〜V5の合格や本人受入を示しません。{unavailable ? 'レビューの取得に失敗しました。保存結果は引き続き閲覧できます。' : '登録されたレビューだけを表示しています。未記録の項目は合格と判断しません。'}</p>
    {review !== null && !mismatch ? <p className="signal-subtle">レビュー日時：{review.reviewedAt ?? '未記録'} · 参照記録：{review.reviewReference}</p> : null}
  </section>;
}

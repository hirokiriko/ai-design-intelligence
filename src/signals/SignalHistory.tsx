import type { Run } from './contract';
import { dataModeLabel, factsOnlyRun, runStatusLabel } from './labels';
import { SignalRunReview } from './SignalRunReview';
import { runReviewKey, type RunReviews } from './run-review';

export type HistoryState = 'loading' | 'ready' | 'error';
export function SignalHistory({ runs, selectedId, state, disabled, onSelect, reviews }: {
  runs: Run[]; selectedId?: string; state: HistoryState; disabled: boolean; onSelect: (id: string) => void; reviews?: RunReviews;
}) {
  return <>
    {state === 'loading' ? <p className="signal-subtle" role="status">保存履歴を読み込んでいます。</p> : null}
    {state === 'error' ? <p className="signal-subtle">保存履歴を取得できません。履歴がないと判断せず、再取得してください。</p> : null}
    {runs.length ? <ol className="signal-history">{runs.map((item) => <li key={item.id}>
      <button type="button" disabled={disabled} aria-current={selectedId === item.id ? 'true' : undefined} onClick={() => onSelect(item.id)}>
        <strong>{runStatusLabel(item)}</strong>{selectedId === item.id ? <span className="signal-history-current">表示中</span> : null}<span>{item.createdAt}</span><span>{item.schemaVersion !== '1.0.0' ? factsOnlyRun(item) ? '公開書誌事項の比較（原文・図面なし）' : dataModeLabel(item.input.context.dataMode) : '架空データ（旧形式）'}</span><span>{item.schemaVersion !== '1.0.0' ? `${item.input.context.entity.name ?? '企業名不明'} / ${item.input.context.category.label}` : item.input.watch.name}</span>{item.schemaVersion === '2.2.0' || item.schemaVersion === '2.3.0' || item.schemaVersion === '2.5.0' ? <span>保存された比較組：{item.input.comparisonPair?.label ?? '選択なし'}</span> : null}<span>実行時の問い：{item.schemaVersion === '2.5.0' ? item.input.analysisQuestion.text : '未記録'}</span>
        <SignalRunReview run={item} state={reviews?.[runReviewKey(item)]} compact />
      </button>
    </li>)}</ol> : state === 'ready' ? <p className="signal-subtle">まだ保存結果はありません。</p> : null}
  </>;
}

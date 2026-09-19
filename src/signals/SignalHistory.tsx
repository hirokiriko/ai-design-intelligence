import type { Run } from './contract';
import { runLabels } from './labels';

export type HistoryState = 'loading' | 'ready' | 'error';
export function SignalHistory({ runs, selectedId, state, disabled, onSelect }: {
  runs: Run[]; selectedId?: string; state: HistoryState; disabled: boolean; onSelect: (id: string) => void;
}) {
  return <>
    {state === 'loading' ? <p className="signal-subtle" role="status">保存履歴を読み込んでいます。</p> : null}
    {state === 'error' ? <p className="signal-subtle">保存履歴を取得できません。履歴がないと判断せず、再取得してください。</p> : null}
    {runs.length ? <ol className="signal-history">{runs.map((item) => <li key={item.id}>
      <button type="button" disabled={disabled} aria-current={selectedId === item.id ? 'true' : undefined} onClick={() => onSelect(item.id)}>
        <strong>{runLabels[item.status]}</strong><span>{item.createdAt}</span>
      </button>
    </li>)}</ol> : state === 'ready' ? <p className="signal-subtle">まだ保存結果はありません。</p> : null}
  </>;
}

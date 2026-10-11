import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { RunV23 } from './contract';

function initialSelection(run: RunV23) {
  const { beforeDataset, afterDataset } = run.input.context;
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const allowed = new Set([beforeDataset.id, afterDataset.id]);
  if (!params.has('comparisonBefore') && !params.has('comparisonAfter')) return { before: beforeDataset.id, after: afterDataset.id };
  const before = params.get('comparisonBefore');
  const after = params.get('comparisonAfter');
  return { before: before && allowed.has(before) ? before : '', after: after && allowed.has(after) ? after : '' };
}

export function SignalComparisonGate({ run, children }: { run: RunV23; children: ReactNode }) {
  const { context } = run.input;
  const [selection, setSelection] = useState(() => initialSelection(run));
  const [submitted, setSubmitted] = useState(true);
  const [viewRequest, setViewRequest] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const restoreUrl = () => { setSelection(initialSelection(run)); setSubmitted(true); };
    window.addEventListener('popstate', restoreUrl);
    return () => window.removeEventListener('popstate', restoreUrl);
  }, [run]);
  const matches = selection.before !== selection.after && selection.before === context.beforeDataset.id && selection.after === context.afterDataset.id;
  useEffect(() => {
    if (!submitted || !matches || !viewRequest) return;
    const target = form.current?.closest('main')?.querySelector<HTMLElement>('#signal-approved-scope');
    target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [submitted, matches, viewRequest]);
  const datasets = [context.beforeDataset, context.afterDataset].filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index);
  const remember = (next: typeof selection) => {
    const url = new URL(window.location.href);
    url.searchParams.set('comparisonBefore', next.before); url.searchParams.set('comparisonAfter', next.after);
    url.searchParams.delete('record');
    window.history.replaceState(null, '', url);
  };
  const change = (field: 'before' | 'after', value: string) => {
    if (!datasets.some((item) => item.id === value)) return;
    const next = { ...selection, [field]: value };
    setSelection(next); setSubmitted(false); remember(next);
  };
  const restore = () => {
    const next = { before: context.beforeDataset.id, after: context.afterDataset.id };
    setSelection(next); setSubmitted(true); setViewRequest((value) => value + 1); remember(next);
  };
  return <>
    <section className="signal-panel signal-comparison-preset" aria-labelledby="signal-preset-title"><p className="signal-eyebrow">登録済みの比較条件</p><h2 id="signal-preset-title">企業・分野と、比較する収録時点</h2>
      <form ref={form} onSubmit={(event) => { event.preventDefault(); setSubmitted(true); setViewRequest((value) => value + 1); }}><div className="signal-preset-fields">
        <div><span>対象の企業・分類</span><strong>{context.entity.name ?? '企業名不明'}</strong><small>{context.category.label} · この画面の登録済みプリセットは1件です。</small></div>
        <label>前の収録集合<select aria-label="前の収録集合" value={selection.before} onChange={(event) => change('before', event.target.value)}>{!selection.before ? <option value="" disabled>未指定・未登録</option> : null}{datasets.map((item) => <option key={item.id} value={item.id}>基準日 {item.dataAsOf}</option>)}</select></label>
        <label>後の収録集合<select aria-label="後の収録集合" value={selection.after} onChange={(event) => change('after', event.target.value)}>{!selection.after ? <option value="" disabled>未指定・未登録</option> : null}{datasets.map((item) => <option key={item.id} value={item.id}>基準日 {item.dataAsOf}</option>)}</select></label>
      </div><div className="signal-preset-actions"><button className="signal-button" type="submit">保存された差分を見る</button><p className="signal-subtle">初期表示はこの条件の保存結果です。条件の選択・再表示では、新しい分析は始まりません。</p></div></form>
    </section>
    {submitted && matches ? children : <section className="signal-panel signal-comparison-unavailable" role="status"><h2>{submitted ? 'この条件では保存比較を表示できません' : '条件を変更しました'}</h2><p>{!submitted ? '前の条件の結果を閉じました。「保存された差分を見る」で、選んだ条件を確認してください。' : !selection.before || !selection.after ? '指定された収録集合を確認できません。登録された前後の集合を選んでください。' : selection.before === selection.after ? '同じ収録集合が選ばれています。前後の異なる収録集合を選んでください。' : 'この組み合わせに一致する保存結果はありません。反対向きの結果を流用したり、件数だけで差分を作ったりはしません。'}</p><p>新しい比較・資料取得・AI分析は開始していません。</p><button className="signal-button secondary" type="button" onClick={restore}>登録済みの比較条件に戻す</button></section>}
  </>;
}

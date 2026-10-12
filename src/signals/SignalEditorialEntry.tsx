import { useCallback, useEffect, useRef, useState } from 'react';
import { loadEditorialComparison, type EditorialComparison } from './editorial-comparison';
import { SignalEditorialComparison } from './SignalEditorialComparison';

type State = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; comparison: EditorialComparison };

export function SignalEditorialEntry({ companyName, autoLoad = false, summaryOnly = false }: { companyName: string; autoLoad?: boolean; summaryOnly?: boolean }) {
  const [state, setState] = useState<State>({ status: autoLoad ? 'loading' : 'idle' });
  const controller = useRef<AbortController | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const focusRequested = useRef(false);
  useEffect(() => {
    if (state.status !== 'ready' || !focusRequested.current) return;
    const target = content.current?.querySelector<HTMLElement>('#signal-editorial-comparison');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [state]);
  const open = useCallback(async (focus = false) => {
    if (controller.current && !controller.current.signal.aborted) return;
    const request = new AbortController();
    controller.current = request;
    focusRequested.current = focus;
    setState({ status: 'loading' });
    try {
      const comparison = await loadEditorialComparison(companyName, fetch, request.signal);
      if (!request.signal.aborted) setState({ status: 'ready', comparison });
    } catch {
      if (!request.signal.aborted) setState({ status: 'error' });
    }
  }, [companyName]);
  useEffect(() => {
    let active = true;
    if (autoLoad) void Promise.resolve().then(() => { if (active) void open(); });
    return () => { active = false; controller.current?.abort(); };
  }, [autoLoad, open]);
  return <div className="signal-editorial-entry" id="signal-editorial-content" ref={content}>
    {state.status === 'ready' ? <SignalEditorialComparison comparison={state.comparison} summaryOnly={summaryOnly} /> : summaryOnly ? <section className="signal-panel" aria-label="公式商品仕様の比較（保存済み要約）">
      <h2>公式商品仕様の比較（保存済み要約）</h2>
      {state.status === 'error' ? <><p role="status">保存された比較要約を読み込めませんでした。公報の保存結果は下で確認できます。</p><button className="signal-button" type="button" onClick={() => { controller.current?.abort(); void open(true); }}>比較要約を読み直す</button></> : <p role="status">保存された商品比較の要約を読み込んでいます。</p>}
    </section> : <div className="signal-editorial-invitation">
      <div><p className="signal-eyebrow">公式資料から調べる · 別の比較実例</p><h3>製品の違いから、次の問いを見つける</h3><p>過去の公式資料を編集した比較です。この収録の増減・自動監視・AI結果とは区別します。</p></div>
      {state.status !== 'error' ? <button className="signal-button" type="button" onClick={() => void open(true)} disabled={state.status !== 'idle'} aria-controls="signal-editorial-content">{state.status === 'loading' ? '比較資料を読んでいます' : '公式資料の製品比較を見る'}</button> : <p role="status">公式資料の比較例を確認できません。下の保存意匠の閲覧は続けられます。再確認するには、画面上部の「保存資料を読み直す」を押してください。</p>}
    </div>}
  </div>;
}

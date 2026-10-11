import { useEffect, useRef, useState } from 'react';
import { loadEditorialComparison, type EditorialComparison } from './editorial-comparison';
import { SignalEditorialComparison } from './SignalEditorialComparison';

type State = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; comparison: EditorialComparison };

export function SignalEditorialEntry({ companyName }: { companyName: string }) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const started = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (state.status !== 'ready') return;
    const target = content.current?.querySelector<HTMLElement>('#signal-editorial-comparison');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [state]);
  const open = async () => {
    if (started.current) return;
    started.current = true;
    const request = new AbortController();
    controller.current = request;
    setState({ status: 'loading' });
    try {
      const comparison = await loadEditorialComparison(companyName, fetch, request.signal);
      if (!request.signal.aborted) setState({ status: 'ready', comparison });
    } catch {
      if (!request.signal.aborted) setState({ status: 'error' });
    }
  };
  return <div className="signal-editorial-entry" id="signal-editorial-content" ref={content}>
    {state.status === 'ready' ? <SignalEditorialComparison comparison={state.comparison} /> : <div className="signal-editorial-invitation">
      <div><p className="signal-eyebrow">公式資料から調べる · 別の比較実例</p><h3>製品の違いから、次の問いを見つける</h3><p>過去の公式資料を編集した比較です。この収録の増減・自動監視・AI結果とは区別します。</p></div>
      {state.status !== 'error' ? <button className="signal-button" type="button" onClick={() => void open()} disabled={state.status !== 'idle'} aria-controls="signal-editorial-content">{state.status === 'loading' ? '比較資料を読んでいます' : '公式資料の製品比較を見る'}</button> : <p role="status">公式資料の比較例を確認できません。下の保存意匠の閲覧は続けられます。再確認するには、画面上部の「保存資料を読み直す」を押してください。</p>}
    </div>}
  </div>;
}

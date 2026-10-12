import { useCallback, useEffect, useRef, useState } from 'react';
import { loadEditorialComparison, type EditorialComparison } from './editorial-comparison';
import { SignalEditorialComparison } from './SignalEditorialComparison';

type State = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; comparison: EditorialComparison; selected?: boolean };

export function SignalEditorialEntry({ companyName, autoLoad = false, summaryOnly = false, candidateFlow = false }: { companyName: string; autoLoad?: boolean; summaryOnly?: boolean; candidateFlow?: boolean }) {
  const [state, setState] = useState<State>({ status: autoLoad ? 'loading' : 'idle' });
  const controller = useRef<AbortController | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const focusRequested = useRef<string | null>(null);
  useEffect(() => {
    if (state.status !== 'ready' || !focusRequested.current) return;
    const target = content.current?.querySelector<HTMLElement>(focusRequested.current);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: 'auto' });
    focusRequested.current = null;
  }, [state]);
  const open = useCallback(async (focus = false) => {
    if (controller.current && !controller.current.signal.aborted) return;
    const request = new AbortController();
    controller.current = request;
    focusRequested.current = null;
    setState({ status: 'loading' });
    try {
      const comparison = await loadEditorialComparison(companyName, fetch, request.signal);
      if (!request.signal.aborted) {
        focusRequested.current = focus ? candidateFlow && comparison.version === 3 ? '#signal-editorial-open-candidate' : '#signal-editorial-comparison' : null;
        setState({ status: 'ready', comparison });
      }
    } catch {
      if (!request.signal.aborted) setState({ status: 'error' });
    }
  }, [companyName, candidateFlow]);
  useEffect(() => {
    let active = true;
    if (autoLoad) void Promise.resolve().then(() => { if (active) void open(); });
    return () => { active = false; controller.current?.abort(); };
  }, [autoLoad, open]);
  const candidate = state.status === 'ready' && candidateFlow && state.comparison.version === 3;
  const select = (selected: boolean) => {
    if (state.status !== 'ready') return;
    focusRequested.current = selected ? '#signal-editorial-comparison' : '#signal-editorial-open-candidate';
    setState({ status: 'ready', comparison: state.comparison, ...(selected ? { selected: true } : {}) });
  };
  return <div className="signal-editorial-entry" id="signal-editorial-content" ref={content}>
    {state.status === 'ready' ? candidate && !state.selected ? <EditorialCandidate comparison={state.comparison} onSelect={() => select(true)} /> : <>{candidate ? <button type="button" className="signal-text-button signal-editorial-back" onClick={() => select(false)}>保存候補一覧へ戻る</button> : null}<SignalEditorialComparison comparison={state.comparison} summaryOnly={summaryOnly} /></> : summaryOnly ? <section className="signal-panel" aria-label={candidateFlow ? '公式商品資料の保存候補' : '公式商品仕様の比較（保存済み要約）'}>
      <h2>{candidateFlow ? '公式商品資料の保存候補' : '公式商品仕様の比較（保存済み要約）'}</h2>
      {state.status === 'error' ? <><p role="status">保存された比較要約を読み込めませんでした。公報の保存結果は下で確認できます。</p><button className="signal-button" type="button" onClick={() => { controller.current?.abort(); void open(true); }}>比較要約を読み直す</button></> : <p role="status">保存された商品比較の要約を読み込んでいます。</p>}
    </section> : <div className="signal-editorial-invitation">
      <div><p className="signal-eyebrow">公式資料から調べる · 別の比較実例</p><h3>製品の違いから、次の問いを見つける</h3><p>過去の公式資料を編集した比較です。この収録の増減・自動監視・AI結果とは区別します。</p></div>
      {state.status !== 'error' ? <button className="signal-button" type="button" onClick={() => void open(true)} disabled={state.status !== 'idle'} aria-controls="signal-editorial-content">{state.status === 'loading' ? '比較資料を読んでいます' : '公式資料の製品比較を見る'}</button> : <p role="status">公式資料の比較例を確認できません。下の保存意匠の閲覧は続けられます。再確認するには、画面上部の「保存資料を読み直す」を押してください。</p>}
    </div>}
  </div>;
}

function EditorialCandidate({ comparison, onSelect }: { comparison: EditorialComparison; onSelect: () => void }) {
  const times = [...new Set(comparison.verification!.quotes.map((quote) => quote.retrievedAt))].sort((a, b) => Date.parse(a) - Date.parse(b));
  const format = (value: string) => new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Tokyo' }).format(new Date(value));
  return <section className="signal-panel signal-editorial-candidates" id="signal-editorial-candidates" aria-labelledby="signal-editorial-candidate-title">
    <p className="signal-eyebrow">公式商品資料から選ぶ</p><h2 id="signal-editorial-candidate-title">対象と保存候補</h2>
    <dl className="signal-editorial-candidate-scope"><div><dt>対象企業</dt><dd>{comparison.companyName}</dd></div><div><dt>製品分野</dt><dd>{comparison.discovery!.productKind}</dd></div><div><dt>資料の取得日時</dt><dd><time dateTime={times[0]}>{format(times[0])}</time>{times.length > 1 ? <> ～ <time dateTime={times[times.length - 1]}>{format(times[times.length - 1])}</time></> : null}（日本時間）</dd></div></dl>
    <p className="signal-subtle">同じ取得回の製品間比較です。前回との差は未判定（前回の取得資料なし）。</p>
    <h3>比較候補 1件（2製品）</h3><article className="signal-editorial-candidate"><h4>{comparison.products.map(({ label }) => label).join(' / ')}</h4><p>{comparison.title}</p><p><strong>選定理由（編集）：</strong>{comparison.discovery!.selectionReason}</p><button id="signal-editorial-open-candidate" type="button" className="signal-button signal-primary" onClick={onSelect} aria-controls="signal-editorial-comparison">この候補の商品比較を開く</button></article>
  </section>;
}

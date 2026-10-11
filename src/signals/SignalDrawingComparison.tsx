import { useEffect, useId, useRef, useState } from 'react';
import type { ComparisonMedia } from './contract';
import { comparisonStatusLabel } from './labels';
import './SignalDrawingComparison.css';

interface SignalDrawingComparisonProps {
  media: readonly ComparisonMedia[];
  mediaUrl?: (media: ComparisonMedia) => string;
}

const normalMediaUrl = (media: ComparisonMedia) => `/api/v1/media/${encodeURIComponent(media.id)}`;
const zoomLevels = [1, 1.5, 2, 3];

function DrawingPane({ media, url, zoom }: { media: ComparisonMedia; url: string; zoom: number }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const label = `${media.role === 'comparisonA' ? '比較A' : '比較B'} · ${media.label}`;
  return <figure className="signal-drawing-pane">
    <figcaption><strong>{label}</strong><span>{media.view ?? '方向不明'} / {comparisonStatusLabel(media.comparisonStatus)}</span></figcaption>
    <div className="signal-drawing-viewport" role="region" aria-label={`${label}の拡大図面。スクロールして細部を確認`} tabIndex={0} aria-busy={status === 'loading'}>
      {status === 'loading' ? <p role="status" className="signal-drawing-loading">図面を読み込み中…</p> : null}
      {status === 'failed' ? <p role="status" className="signal-drawing-error">{label}を表示できません。画像を確認できるまで、形状は判断しません。閉じて元の資料をご確認ください。</p> : <img src={url} width={media.width} height={media.height} style={{ width: `${zoom * 100}%` }} alt={`${label}。${media.view ?? '方向不明'}。${comparisonStatusLabel(media.comparisonStatus)}`} onLoad={() => setStatus('ready')} onError={() => setStatus('failed')} />}
    </div>
    <dl className="signal-drawing-attribution"><div><dt>出典・利用条件</dt><dd>{media.sourceLabel} / {media.permission}</dd></div><div><dt>公報日 / 出願日</dt><dd>{media.gazetteDate ?? '不明'} / {media.applicationDate ?? '不明'}</dd></div></dl>
  </figure>;
}

export function SignalDrawingComparison({ media, mediaUrl = normalMediaUrl }: SignalDrawingComparisonProps) {
  const [open, setOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const first = media.find((item) => item.role === 'comparisonA');
  const second = media.find((item) => item.role === 'comparisonB');
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);
  if (media.length !== 2 || !first || !second || first.id === second.id) return null;
  const restoreFocus = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  return <div className="signal-drawing-comparison">
    <button ref={trigger} type="button" className="signal-button" aria-haspopup="dialog" aria-controls={open ? id : undefined} onClick={() => { setZoomIndex(0); setOpen(true); }}>比較A・Bの図面を並べて拡大</button>
    {open ? <dialog ref={dialog} id={id} className="signal-drawing-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-guide`} onClose={restoreFocus}>
      <header className="signal-drawing-header"><h2 id={`${id}-title`}>比較A・Bの図面を見比べる</h2><button type="button" className="signal-button" autoFocus onClick={() => dialog.current?.close()}>閉じる</button></header>
      <p id={`${id}-guide`} className="signal-subtle">2枚に同じ表示倍率を適用します。細部はそれぞれの図面をスクロールして確認できます。比較A/Bは資料の役割で、図面の縮尺・製品の世代・発売順を示しません。</p>
      <div className="signal-drawing-toolbar" role="group" aria-label="2枚の図面の表示倍率">
        <button type="button" className="signal-button" disabled={zoomIndex === 0} onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}>縮小</button>
        <output aria-live="polite">表示倍率 {zoomLevels[zoomIndex] * 100}%</output>
        <button type="button" className="signal-button" disabled={zoomIndex === zoomLevels.length - 1} onClick={() => setZoomIndex((index) => Math.min(zoomLevels.length - 1, index + 1))}>拡大</button>
        <button type="button" className="signal-text-button" onClick={() => setZoomIndex(0)}>100%表示に戻す</button>
      </div>
      <div className="signal-drawing-pair"><DrawingPane key={first.id} media={first} url={mediaUrl(first)} zoom={zoomLevels[zoomIndex]} /><DrawingPane key={second.id} media={second} url={mediaUrl(second)} zoom={zoomLevels[zoomIndex]} /></div>
    </dialog> : null}
  </div>;
}

import { useEffect, useId, useRef, useState } from 'react';
import type { ComparisonMedia } from './contract';
import { comparisonStatusLabel } from './labels';
import './SignalDrawingComparison.css';

interface SignalDrawingComparisonProps {
  media: readonly ComparisonMedia[];
  mediaUrl?: (media: ComparisonMedia) => string;
  focusPoints?: readonly { id: string; text: string; mediaIds: readonly string[] }[];
  onContinueToSources?: () => void;
}

const normalMediaUrl = (media: ComparisonMedia) => `/api/v1/media/${encodeURIComponent(media.id)}`;
const zoomLevels = [1, 1.5, 2, 3];

function DrawingPane({ media, url, zoom, focused }: { media: ComparisonMedia; url: string; zoom: number; focused: boolean | null }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const label = `${media.role === 'comparisonA' ? '比較A' : '比較B'} · ${media.label}`;
  return <figure className="signal-drawing-pane" data-focus={focused ?? undefined}>
    <figcaption><strong>{label}</strong><span>{media.view ?? '方向不明'} / {comparisonStatusLabel(media.comparisonStatus)}</span>{focused !== null ? <span className="signal-drawing-reference">{focused ? 'この着目点の参照図面' : 'この着目点からの参照なし'}</span> : null}</figcaption>
    <div className="signal-drawing-viewport" role="region" aria-label={`${label}の拡大図面。スクロールして細部を確認`} tabIndex={0} aria-busy={status === 'loading'}>
      {status === 'loading' ? <p role="status" className="signal-drawing-loading">図面を読み込み中…</p> : null}
      {status === 'failed' ? <p role="status" className="signal-drawing-error">{label}を表示できません。画像を確認できるまで、形状は判断しません。閉じて元の資料をご確認ください。</p> : <img src={url} width={media.width} height={media.height} style={{ width: `${zoom * 100}%` }} alt={`${label}。${media.view ?? '方向不明'}。${comparisonStatusLabel(media.comparisonStatus)}`} onLoad={() => setStatus('ready')} onError={() => setStatus('failed')} />}
    </div>
    <dl className="signal-drawing-attribution"><div><dt>出典・利用条件</dt><dd>{media.sourceLabel} / {media.permission}</dd></div><div><dt>公報日 / 出願日</dt><dd>{media.gazetteDate ?? '不明'} / {media.applicationDate ?? '不明'}</dd></div></dl>
  </figure>;
}

export function SignalDrawingComparison({ media, mediaUrl = normalMediaUrl, focusPoints = [], onContinueToSources }: SignalDrawingComparisonProps) {
  const [open, setOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const continueOnClose = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const first = media.find((item) => item.role === 'comparisonA');
  const second = media.find((item) => item.role === 'comparisonB');
  const canInspect = (point: typeof focusPoints[number]) => point.mediaIds.length > 0 && point.mediaIds.every((mediaId) => media.some((item) => item.id === mediaId));
  const selectedPoint = focusPoints.find((point) => point.id === focusId && canInspect(point));
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);
  if (media.length !== 2 || !first || !second || first.id === second.id) return null;
  const restoreFocus = () => {
    setOpen(false);
    if (continueOnClose.current) { continueOnClose.current = false; onContinueToSources?.(); }
    else (opener.current?.isConnected ? opener.current : trigger.current)?.focus({ preventScroll: true });
  };
  const openComparison = (button: HTMLButtonElement, pointId: string | null) => {
    opener.current = button; continueOnClose.current = false;
    button.focus({ preventScroll: true });
    setFocusId(pointId); setZoomIndex(0); setOpen(true);
  };
  return <div className="signal-drawing-comparison">
    {focusPoints.length ? <div className="signal-drawing-focus-start" role="group" aria-label="着目点を選んで原図と見比べる">{focusPoints.map((point, index) => <button key={point.id} type="button" className="signal-drawing-focus-card" disabled={!canInspect(point)} aria-haspopup="dialog" aria-controls={open ? id : undefined} onClick={(event) => openComparison(event.currentTarget, point.id)}><span>着目点 {index + 1}</span><strong>{point.text.split('。')[0]}{point.text.includes('。') ? '。' : ''}</strong><span>{canInspect(point) ? '観察全文と参照図面を開く →' : '参照図面を確認できません'}</span></button>)}</div> : null}
    <button ref={trigger} type="button" className="signal-button" aria-haspopup="dialog" aria-controls={open ? id : undefined} onClick={(event) => openComparison(event.currentTarget, null)}>比較A・Bの図面を並べて拡大</button>
    {open ? <dialog ref={dialog} id={id} className="signal-drawing-dialog" aria-labelledby={`${id}-title`} aria-describedby={selectedPoint ? `${id}-focus-text` : `${id}-guide`} onClose={restoreFocus}>
      <header className="signal-drawing-header"><h2 id={`${id}-title`}>比較A・Bの図面を見比べる</h2><button type="button" className="signal-button" autoFocus onClick={() => dialog.current?.close()}>閉じる</button></header>
      {focusPoints.length ? <section className="signal-drawing-inspection" aria-label="原図と照合する着目点"><div className="signal-drawing-focus-switch" role="group" aria-label="照合する着目点"><button className="signal-text-button" type="button" aria-pressed={!selectedPoint} onClick={() => setFocusId(null)}>全体を見る</button>{focusPoints.map((point, index) => <button key={point.id} className="signal-text-button" type="button" disabled={!canInspect(point)} aria-pressed={selectedPoint?.id === point.id} onClick={() => setFocusId(point.id)}>着目点 {index + 1}</button>)}</div>{selectedPoint ? <p id={`${id}-focus-text`} aria-live="polite">{selectedPoint.text}</p> : <p className="signal-subtle">着目点を選ぶと、保存された観察全文と参照する図面を一緒に確認できます。</p>}</section> : null}
      <details className="signal-drawing-guide"><summary>比較条件・表示倍率について</summary><p id={`${id}-guide`} className="signal-subtle">2枚に同じ表示倍率を適用します。細部はそれぞれの図面をスクロールして確認できます。比較A/Bは資料の役割で、図面の縮尺・製品の世代・発売順を示しません。着目点は参照図面との対応です。図面内の位置を自動で特定した表示ではありません。</p></details>
      <div className="signal-drawing-toolbar" role="group" aria-label="2枚の図面の表示倍率">
        <button type="button" className="signal-button" disabled={zoomIndex === 0} onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}>縮小</button>
        <output aria-live="polite">表示倍率 {zoomLevels[zoomIndex] * 100}%</output>
        <button type="button" className="signal-button" disabled={zoomIndex === zoomLevels.length - 1} onClick={() => setZoomIndex((index) => Math.min(zoomLevels.length - 1, index + 1))}>拡大</button>
        <button type="button" className="signal-text-button" onClick={() => setZoomIndex(0)}>100%表示に戻す</button>
      </div>
      <div className="signal-drawing-pair"><DrawingPane key={first.id} media={first} url={mediaUrl(first)} zoom={zoomLevels[zoomIndex]} focused={selectedPoint ? selectedPoint.mediaIds.includes(first.id) : null} /><DrawingPane key={second.id} media={second} url={mediaUrl(second)} zoom={zoomLevels[zoomIndex]} focused={selectedPoint ? selectedPoint.mediaIds.includes(second.id) : null} /></div>
      {onContinueToSources ? <footer className="signal-drawing-next"><button type="button" className="signal-button" onClick={() => { continueOnClose.current = true; dialog.current?.close(); }}>公式引用が支える範囲へ進む →</button></footer> : null}
    </dialog> : null}
  </div>;
}

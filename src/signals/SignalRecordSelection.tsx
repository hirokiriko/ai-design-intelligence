import { Fragment, useContext, useEffect, useState, type ReactNode } from 'react';
import type { RunV23 } from './contract';
import { RecordSelectionContext, recordIdFromUrl } from './record-selection';

export function SignalRecordSelection({ run, children }: { run: RunV23; children: ReactNode }) {
  const [selectedId, setSelectedId] = useState(() => recordIdFromUrl(run));
  useEffect(() => {
    const restore = () => setSelectedId(recordIdFromUrl(run));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [run]);
  const select = (id: string) => {
    if (!run.signal?.recordFacts.some((fact) => fact.recordId === id)) return;
    setSelectedId(id);
    const url = new URL(window.location.href); url.searchParams.set('record', id); window.history.replaceState(null, '', url);
  };
  return <RecordSelectionContext.Provider value={{ selectedId, select }}>{children}</RecordSelectionContext.Provider>;
}

export function SignalRecordEvidenceBoundary({ run, children }: { run: RunV23; children: ReactNode }) {
  const { selectedId } = useContext(RecordSelectionContext);
  const signal = run.signal;
  const record = signal?.recordFacts.find((fact) => fact.recordId === selectedId);
  if (!record || !signal) return null;
  const selectedMedia = signal.media.filter((item) => item.recordId === record.recordId);
  if (!selectedMedia.length) return <section className="signal-panel signal-scope-independent" id="signal-record-evidence-status" data-record-id={record.recordId} role="status"><h2>登録 {record.registrationNumber ?? '不明'} · 図面と画像観察は未収録です</h2><p>選択した意匠の書誌事項は上の欄で確認できます。形状を調べるには、この意匠の図面が必要です。公式資料との対応も未確認です。</p><a className="signal-text-button" href="#signal-scope-picker-title">ほかの対象を選ぶ</a></section>;
  const others = signal.media.filter((item) => item.recordId !== record.recordId);
  return <Fragment key={record.recordId}>
    <section className="signal-panel signal-scope-independent signal-selected-comparison" id="signal-record-evidence-status" data-record-id={record.recordId}><p className="signal-eyebrow">選択意匠を含む、保存済みの図面比較</p><h2>選択中：{record.articleName ?? '物品名不明'} · 登録 {record.registrationNumber ?? '不明'}</h2><p>選択意匠の図面：{selectedMedia.map((item) => item.label).join(' / ')}</p><p>{others.length ? <>比較相手：{others.map((item) => item.label).join(' / ')}。比較相手は別の意匠です。</> : 'A/Bは同じ意匠の保存図面です。'}以下のA/Bは、保存されているこの組み合わせです。</p><p>公式引用は、この保存比較で取得した参考資料です。選択意匠・比較相手との製品対応は未確認です。</p></section>
    {children}
  </Fragment>;
}

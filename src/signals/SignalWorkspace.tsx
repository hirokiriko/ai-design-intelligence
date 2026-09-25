import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { signalApi, SignalApiError, type SignalApi } from './api';
import { ContractError, type Bootstrap, type ComparisonPair, type Run, type Watch, type WatchInput } from './contract';
import { SignalResult } from './SignalResult';
import { dataModeLabel, factsOnlyRun, runStatusLabel } from './labels';
import { SignalHistory, type HistoryState } from './SignalHistory';
import './signals.css';

interface Props { api?: SignalApi; renderAnalysis?: (datasetId: string) => ReactNode }
type PairState = 'loading' | 'ready' | 'error';
const supportsPairs = (version: Bootstrap['schemaVersion'] | undefined) => version === '2.2.0' || version === '2.3.0';
const selectedRunId = () => typeof window === 'undefined' ? null : new URL(window.location.href).searchParams.get('run');
function saveRunLocation(id: string | null): void {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('run', id); else url.searchParams.delete('run');
  window.history.replaceState(null, '', url);
}
function message(error: unknown): string {
  return error instanceof SignalApiError || error instanceof ContractError ? error.message : '確認処理を利用できません。保存履歴を再取得してください。';
}

export function SignalWorkspace({ api = signalApi, renderAnalysis }: Props) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [watchId, setWatchId] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [historyState, setHistoryState] = useState<HistoryState>('loading');
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('確認条件を読み込んでいます。');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createRevision, setCreateRevision] = useState(0);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [comparisonPairs, setComparisonPairs] = useState<ComparisonPair[]>([]);
  const [selectedPairId, setSelectedPairId] = useState('');
  const [pairState, setPairState] = useState<PairState>('ready');
  const mutation = useRef(false);
  const revision = useRef(0);
  const pairRevision = useRef(0);
  const request = useRef<{ watchId: string; intent: 'check' | 'reanalyze'; comparisonPairId: string; id: string } | null>(null);
  const selectedWatch = bootstrap?.watches.find((item) => item.id === watchId);
  const actionPending = busy || historyState === 'loading';
  const selectionReady = !supportsPairs(bootstrap?.schemaVersion) || (pairState === 'ready' && (comparisonPairs.length === 0 || comparisonPairs.some((pair) => pair.id === selectedPairId)));

  const loadComparisonPairs = useCallback(async (watch: Watch | undefined, version: Bootstrap['schemaVersion']) => {
    const current = ++pairRevision.current;
    setComparisonPairs([]); setSelectedPairId('');
    if (!watch || !supportsPairs(version)) { setPairState('ready'); return; }
    setPairState('loading');
    try {
      const loaded = await api.comparisonPairs(watch);
      if (current !== pairRevision.current) return;
      if (loaded.schemaVersion !== version) throw new ContractError();
      setComparisonPairs(loaded.comparisonPairs); setPairState('ready');
    } catch {
      if (current === pairRevision.current) setPairState('error');
    }
  }, [api]);

  useEffect(() => {
    let active = true;
    void api.bootstrap().then(async (loaded) => {
      const storedId = selectedRunId();
      const saved = storedId ? await api.run(storedId) : null;
      const initialWatch = saved?.watchId ?? loaded.watches[0]?.id ?? '';
      const history = initialWatch ? await api.runs(initialWatch) : [];
      if (!active) return;
      const selected = saved ?? history[0] ?? null;
      setBootstrap(loaded); setWatchId(initialWatch); setRuns(history); setRun(selected); setHistoryState('ready');
      void loadComparisonPairs(loaded.watches.find((watch) => watch.id === initialWatch), loaded.schemaVersion);
      saveRunLocation(selected?.id ?? null);
      setNotice('保存された条件と履歴を読み込みました。更新を確認すると新しい確認処理を開始します。');
    }).catch((failure: unknown) => { if (active) { setError(message(failure)); setNotice('読込に失敗しました。'); } });
    return () => { active = false; revision.current += 1; pairRevision.current += 1; };
  }, [api, loadComparisonPairs]);

  const recoverError = (failure: unknown) => {
    setError(message(failure));
    if (failure instanceof SignalApiError && ['401', '403'].includes(failure.code)) {
      setBootstrap(null); setRuns([]); setRun(null);
    }
  };
  const loadHistory = async (id: string, preserveRun = false) => {
    const current = ++revision.current;
    setError(''); setHistoryState('loading'); setNotice('保存履歴を読み込んでいます。AIは実行しません。');
    try {
      const history = await api.runs(id);
      if (current !== revision.current) return;
      const selected = preserveRun ? history.find((item) => item.id === run?.id) ?? history[0] ?? null : history[0] ?? null;
      setRuns(history); setHistoryState('ready'); setRun(selected); saveRunLocation(selected?.id ?? null);
      setNotice('保存履歴を再取得しました。AIは実行していません。');
    } catch (failure) { if (current === revision.current) { setHistoryState('error'); recoverError(failure); } }
  };
  const changeWatch = (id: string) => {
    setWatchId(id); setRun(null); setRuns([]); setShowAnalysis(false); saveRunLocation(null);
    void loadComparisonPairs(bootstrap?.watches.find((watch) => watch.id === id), bootstrap?.schemaVersion ?? '1.0.0');
    void loadHistory(id);
  };
  const selectRun = async (id: string) => {
    if (historyState === 'loading') return;
    const current = ++revision.current;
    setError(''); setNotice('保存結果を再取得しています。');
    try {
      const selected = await api.run(id);
      if (current !== revision.current) return;
      setRun(selected); saveRunLocation(selected.id); setNotice('保存結果を表示しました。AIは実行していません。');
    } catch (failure) { if (current === revision.current) recoverError(failure); }
  };
  const saveWatch = async (input: WatchInput) => {
    if (!bootstrap || mutation.current || historyState === 'loading') return;
    mutation.current = true; revision.current += 1; setBusy(true); setError('');
    try {
      const saved = await api.saveWatch(input, bootstrap.csrfToken);
      setBootstrap({ ...bootstrap, watches: [...bootstrap.watches, saved] });
      setWatchId(saved.id); setRuns([]); setRun(null); setHistoryState('ready'); setShowCreate(false); saveRunLocation(null);
      void loadComparisonPairs(saved, bootstrap.schemaVersion);
      setNotice('確認条件をバックエンドへ保存しました。「更新を確認」で開始できます。');
    } catch (failure) { recoverError(failure); }
    finally { mutation.current = false; setBusy(false); }
  };
  const startRun = async (intent: 'check' | 'reanalyze') => {
    if (!bootstrap || !selectedWatch || mutation.current || historyState === 'loading' || !selectionReady) return;
    const comparisonPairId = supportsPairs(bootstrap.schemaVersion) ? selectedPairId : '';
    mutation.current = true; revision.current += 1; setBusy(true); setError('');
    setNotice('バックエンドが登録済みデータの差分と資料を確認しています。');
    if (!request.current || request.current.watchId !== watchId || request.current.intent !== intent || request.current.comparisonPairId !== comparisonPairId) request.current = { watchId, intent, comparisonPairId, id: crypto.randomUUID() };
    try {
      const saved = await api.start(watchId, intent, request.current.id, bootstrap.csrfToken, comparisonPairId || undefined);
      request.current = null;
      setRun(saved); setRuns((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]); setHistoryState('ready'); saveRunLocation(saved.id);
      setNotice(`確認結果を表示しました。${runStatusLabel(saved)}。`);
    } catch (failure) { recoverError(failure); setNotice('通信または確認処理が完了していません。履歴で状態を確認してください。'); }
    finally { mutation.current = false; setBusy(false); }
  };
  const refreshDatasets = async () => {
    if (mutation.current || actionPending) return;
    mutation.current = true; revision.current += 1; setBusy(true); setError('');
    try {
      const loaded = await api.bootstrap();
      setBootstrap(loaded); setCreateRevision((value) => value + 1); setShowCreate(true);
      void loadComparisonPairs(loaded.watches.find((watch) => watch.id === watchId), loaded.schemaVersion);
      setNotice('登録済みデータを再取得しました。企業・商品条件を引き継いで収録データを選び、新しい条件を保存してください。過去の結果は変わりません。');
    } catch (failure) { recoverError(failure); }
    finally { mutation.current = false; setBusy(false); }
  };

  return <div className="signals-app">
    <a href="#signal-main" className="signal-skip">確認条件と結果へ移動</a>
    <header className="signal-header"><div><span className="signal-brand-mark" aria-hidden="true">K</span><strong>KIRIKO <span>Design Signals</span></strong></div><span className="signal-header-label">企業・商品の変化を確認</span></header>
    <main id="signal-main" className="signal-main">
      <div className="signal-intro"><p className="signal-eyebrow">変化を見つけ、根拠に戻る</p><h1>次の検討につながる、<br className="signal-mobile-break" />企業と商品のシグナル。</h1><p>保存した企業・商品領域で、前後の収録データと登録済みの参照先を確認します。収録日と採用範囲は保存結果ごとに示します。</p></div>
      <div className="signal-data-banner">保存結果のデータ区分は、各実行に保存された情報で表示します。<span>常時監視・自動通知ではありません。</span></div>
      <p className="signal-live" role="status" aria-live="polite">{notice}</p>
      {error ? <div className="signal-error" role="alert"><p>{error}</p>{!bootstrap ? <button type="button" className="signal-button" onClick={() => window.location.reload()}>認証・設定を確認して再読み込み</button> : null}</div> : null}
      {bootstrap ? <div className="signal-layout">
        <aside className="signal-sidebar" aria-label="保存条件と履歴">
          <section className="signal-panel"><p className="signal-eyebrow">確認条件</p><h2>保存した確認条件</h2>
            {bootstrap.watches.length ? <label className="signal-field">確認する条件<select value={watchId} disabled={busy} onChange={(event) => changeWatch(event.target.value)}>{bootstrap.watches.map((watch) => <option key={watch.id} value={watch.id}>{watch.name}</option>)}</select></label> : <p>最初の確認条件を保存してください。</p>}
            {selectedWatch ? <><WatchSummary watch={selectedWatch} bootstrap={bootstrap} />{supportsPairs(bootstrap.schemaVersion) ? <ComparisonPairSelector pairs={comparisonPairs} state={pairState} selectedId={selectedPairId} busy={actionPending} onSelect={setSelectedPairId} onReload={() => void loadComparisonPairs(selectedWatch, bootstrap.schemaVersion)} /> : null}<button className="signal-button signal-primary" type="button" disabled={actionPending || !selectionReady || run?.status === 'running'} onClick={() => void startRun('check')}>{busy ? '確認しています…' : '更新を確認'}</button><p className="signal-subtle">{supportsPairs(bootstrap.schemaVersion) ? '同じ条件・同じデータ・同じ比較組の確認済み結果がある場合は、保存結果を表示します。比較組の選択や変更だけではAIを実行しません。' : '同じ条件・同じデータの確認済み結果がある場合は、保存結果を表示します。'}</p></> : null}
            {selectedWatch ? <button className="signal-text-button" type="button" disabled={actionPending} onClick={() => void refreshDatasets()}>同じ企業・商品条件で収録データを選び直す</button> : null}
            <button className="signal-text-button" type="button" disabled={busy} aria-expanded={showCreate} onClick={() => setShowCreate(!showCreate)}>{showCreate ? '条件の作成を閉じる' : '＋ 確認条件を保存'}</button>
            {showCreate || !bootstrap.watches.length ? <WatchForm key={`${selectedWatch?.id ?? 'new'}-${createRevision}`} bootstrap={bootstrap} seed={selectedWatch} busy={actionPending} onSave={saveWatch} /> : null}
          </section>
          <section className="signal-panel"><h2>保存履歴</h2><button className="signal-text-button" type="button" disabled={busy || !watchId} onClick={() => void loadHistory(watchId, true)}>履歴を再取得</button>
            <SignalHistory runs={runs} selectedId={run?.id} state={historyState} disabled={actionPending} onSelect={(id) => void selectRun(id)} />
            {run && run.status !== 'running' ? <details className="signal-details"><summary>新しい実行として確認し直す</summary><p className="signal-subtle">{factsOnlyRun(run) ? '過去の結果を残して、登録済み書誌事項を新しい実行として再比較します。記事取得・AI呼出は行いません。' : supportsPairs(bootstrap.schemaVersion) ? '過去の結果を残して、上で選んだ比較組でAI・公式確認を新しく実行します。' : '過去の結果を残して、AI・公式確認を新しく実行します。'}</p><button className="signal-button" type="button" disabled={actionPending || !selectionReady} onClick={() => void startRun('reanalyze')}>別の実行として再確認</button></details> : null}
          </section>
        </aside>
        <div className="signal-content">{run ? <SignalResult key={run.id} run={run} /> : <section className="signal-panel signal-welcome"><span aria-hidden="true" className="signal-welcome-symbol">↗</span><h2>気になる変化を、根拠とともに。</h2><p>保存条件を選び「更新を確認」を押してください。</p><ol><li>意匠データの差分</li><li>登録資料に画像がある場合の観察候補</li><li>参照先と未確認事項</li></ol><p className="signal-subtle">変化なし・資料不足も結果として保存されます。</p></section>}</div>
      </div> : null}
      {renderAnalysis && selectedWatch ? <section className="signal-legacy"><button className="signal-text-button" type="button" disabled={busy} aria-expanded={showAnalysis} onClick={() => setShowAnalysis(!showAnalysis)}>既存の市場・企業ルール分析 {showAnalysis ? 'を閉じる' : 'を開く'}</button>{showAnalysis ? renderAnalysis(selectedWatch.afterDatasetId) : null}</section> : null}
    </main><footer className="signal-footer">参考情報です。収録範囲外や最新の法的状態は示しません。事実・AI観察候補・関連仮説を区別して確認してください。</footer>
  </div>;
}

function ComparisonPairSelector({ pairs, state, selectedId, busy, onSelect, onReload }: { pairs: ComparisonPair[]; state: PairState; selectedId: string; busy: boolean; onSelect: (id: string) => void; onReload: () => void }) {
  const selected = pairs.find((pair) => pair.id === selectedId);
  return <div className="signal-pair-selector"><p className="signal-subtle">次の実行で使う登録済み比較組を選択します。閲覧中の保存結果は変わりません。</p>
    {state === 'loading' ? <p role="status">比較組の候補を読み込んでいます。</p> : null}
    {state === 'error' ? <div role="alert" className="signal-error"><p>比較組の候補を確認できません。実行前に再取得してください。</p><button className="signal-button" type="button" disabled={busy} onClick={onReload}>比較組を再取得</button></div> : null}
    {state === 'ready' && pairs.length === 0 ? <p className="signal-subtle">この条件で選択できる比較組はありません。画像がない結果も保存できます。</p> : null}
    {state === 'ready' && pairs.length > 0 ? <label className="signal-field">次の実行に使う比較組<select value={selectedId} required disabled={busy} onChange={(event) => onSelect(event.target.value)}><option value="">比較組を選択してください</option>{pairs.map((pair) => <option key={pair.id} value={pair.id}>{pair.label}</option>)}</select></label> : null}
    {selected ? <dl className="signal-metadata"><div><dt>登録時の比較条件・根拠</dt><dd>{selected.evidence}</dd></div>{selected.media.map((media) => <div key={media.id}><dt>{media.role === 'comparisonA' ? '比較A' : '比較B'}の対象</dt><dd>{media.label}<small>{media.view ?? '方向不明'} · {media.comparisonStatus}</small></dd></div>)}</dl> : null}
  </div>;
}

function WatchSummary({ watch, bootstrap }: { watch: Watch; bootstrap: Bootstrap }) {
  const before = bootstrap.catalog.datasets.find((item) => item.id === watch.beforeDatasetId);
  const after = bootstrap.catalog.datasets.find((item) => item.id === watch.afterDatasetId);
  return <dl className="signal-metadata"><div><dt>企業</dt><dd>{bootstrap.catalog.entities.find((item) => item.id === watch.entityId)?.name ?? '企業名不明'}</dd></div><div><dt>商品カテゴリー / 分類</dt><dd>{bootstrap.catalog.categories.find((item) => item.id === watch.categoryId)?.label ?? watch.categoryId}</dd></div><div><dt>比較A · 基準日</dt><dd>{before?.dataAsOf ?? '不明'}<small>{before?.coverage ?? '収録範囲不明'}</small></dd></div><div><dt>比較B · 基準日</dt><dd>{after?.dataAsOf ?? '不明'}<small>{after?.coverage ?? '収録範囲不明'}</small></dd></div><div><dt>登録した参照先</dt><dd>{bootstrap.catalog.sourceProfiles.find((item) => item.id === watch.sourceProfileId)?.label ?? watch.sourceProfileId}</dd></div></dl>;
}

function WatchForm({ bootstrap, seed, busy, onSave }: { bootstrap: Bootstrap; seed?: Watch; busy: boolean; onSave: (input: WatchInput) => Promise<void> }) {
  const { entities, categories, datasets, sourceProfiles } = bootstrap.catalog;
  const orderedDatasets = [...datasets].sort((left, right) => left.dataAsOf.localeCompare(right.dataAsOf));
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? '').trim();
    void onSave({ name: field('name'), entityId: field('entityId'), categoryId: field('categoryId'), beforeDatasetId: field('beforeDatasetId'), afterDatasetId: field('afterDatasetId'), sourceProfileId: field('sourceProfileId') });
  };
  return <form className="signal-watch-form" onSubmit={onSubmit}><h3>新しい確認条件</h3><p className="signal-subtle">登録済みの収録データを明示的に選びます。保存後に「更新を確認」で実行してください。元の条件と保存結果は残ります。</p><label className="signal-field">条件名<input name="name" required maxLength={120} defaultValue={seed ? `${Array.from(seed.name).slice(0, 110).join('')}（データ更新）` : '商品の変化を確認'} disabled={busy} /></label><label className="signal-field">企業候補<select name="entityId" required disabled={busy} defaultValue={seed?.entityId}>{entities.map((item) => <option key={item.id} value={item.id}>{item.name ?? '企業名不明'}</option>)}</select></label><label className="signal-field">商品カテゴリー / 分類<select name="categoryId" required disabled={busy} defaultValue={seed?.categoryId}>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="signal-field">比較Aの収録データ<select name="beforeDatasetId" required disabled={busy} defaultValue={seed?.beforeDatasetId ?? orderedDatasets[0]?.id}>{orderedDatasets.map((item) => <option key={item.id} value={item.id}>{item.dataAsOf} · {item.coverage}{item.dataMode ? ` · ${dataModeLabel(item.dataMode)}` : ''}</option>)}</select></label><label className="signal-field">比較Bの収録データ<select name="afterDatasetId" required disabled={busy} defaultValue={seed?.afterDatasetId ?? orderedDatasets[orderedDatasets.length - 1]?.id}>{orderedDatasets.map((item) => <option key={item.id} value={item.id}>{item.dataAsOf} · {item.coverage}{item.dataMode ? ` · ${dataModeLabel(item.dataMode)}` : ''}</option>)}</select></label><label className="signal-field">登録した参照先<select name="sourceProfileId" required disabled={busy} defaultValue={seed?.sourceProfileId}>{sourceProfiles.map((item) => <option key={item.id} value={item.id}>{item.label}{item.dataMode ? ` · ${dataModeLabel(item.dataMode)}` : ''}</option>)}</select></label><button className="signal-button" type="submit" disabled={busy}>この条件を保存</button></form>;
}

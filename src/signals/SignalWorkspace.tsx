import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { readPendingRunRequests, signalApi, SignalApiError, type PendingRunRequest, type SignalApi } from './api';
import { ContractError, type Bootstrap, type ComparisonPair, type Run, type Watch, type WatchInput } from './contract';
import { SignalResult } from './SignalResult';
import { comparisonPairsVersion, comparisonStatusLabel, dataModeLabel, runStatusLabel } from './labels';
import { SignalHistory, type HistoryState } from './SignalHistory';
import { revealEvidenceLink, revealEvidenceTarget } from './evidence-navigation';
import { SignalEmptyJourney, SignalPurposeIntro, SignalQuestionFocus, SignalQuestionPicker, SignalValuePreview, type SignalQuestion } from './SignalPurposeJourney';
import { analysisQuestion, sameAnalysisQuestion } from './analysis-question';
import { decodeRunReview, runReviewKey, type RunReviews, type RunReviewState } from './run-review';
import './signals.css';

interface Props { api?: SignalApi; renderAnalysis?: (datasetId: string) => ReactNode; developmentMode?: boolean }
type PairState = 'loading' | 'ready' | 'error';
interface ReviewRequest { promise: Promise<RunReviewState>; settled: boolean }
interface ReviewDisplay { api: SignalApi; developmentMode: boolean; reviews: RunReviews }
type PendingRequestState = PendingRunRequest[] | 'unavailable';
function pendingRequestFromBrowser(developmentMode = false): PendingRequestState {
  if (developmentMode || typeof window === 'undefined') return [];
  try { return readPendingRunRequests(); } catch { return 'unavailable'; }
}
const supportsPairs = (version: Bootstrap['schemaVersion'] | undefined) => comparisonPairsVersion(version) !== null;
const selectedRunId = () => typeof window === 'undefined' ? null : new URL(window.location.href).searchParams.get('run');
const reviewRequestKey = (run: Run) => JSON.stringify([runReviewKey(run), run.status]);
function saveRunLocation(id: string | null): void {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('run', id); else url.searchParams.delete('run');
  window.history.replaceState(null, '', url);
}
function message(error: unknown): string {
  return error instanceof SignalApiError || error instanceof ContractError ? error.message : '確認処理を利用できません。保存履歴を再取得してください。';
}
function withReview(previous: ReviewDisplay, api: SignalApi, developmentMode: boolean, key: string, state: RunReviewState): ReviewDisplay {
  const reviews = previous.api === api && previous.developmentMode === developmentMode ? previous.reviews : {};
  return { api, developmentMode, reviews: { ...reviews, [key]: state } };
}

export function SignalWorkspace({ api = signalApi, renderAnalysis, developmentMode = false }: Props) {
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
  const [pendingRequest, setPendingRequest] = useState(() => pendingRequestFromBrowser(developmentMode));
  const mutation = useRef(false);
  const revision = useRef(0);
  const pairRevision = useRef(0);
  const [question, setQuestion] = useState<SignalQuestion | null>(null);
  const main = useRef<HTMLElement>(null);
  const resultRequested = useRef(false);
  const [reviewDisplay, setReviewDisplay] = useState<ReviewDisplay>(() => ({ api, developmentMode, reviews: {} }));
  const [reviewRevision, setReviewRevision] = useState(0);
  const reviewMounted = useRef(false);
  const reviewRequests = useRef({ api, developmentMode, requests: new Map<string, ReviewRequest>(), latest: new Map<string, string>() });
  const currentReviews: RunReviews = reviewDisplay.api === api && reviewDisplay.developmentMode === developmentMode ? reviewDisplay.reviews : {};
  const selectedWatch = bootstrap?.watches.find((item) => item.id === watchId);
  const actionPending = busy || historyState === 'loading';
  const selectedWatchPending = pendingRequest === 'unavailable' || pendingRequest.some((pending) => pending.watchId === watchId);
  const creationPending = actionPending || pendingRequest === 'unavailable';
  const questionSupported = bootstrap?.schemaVersion === '2.5.0' && bootstrap.analysisQuestionVersion === '1.0.0' && bootstrap.analysisMode !== 'facts_only';
  const selectionReady = (!questionSupported || question !== null) && (!supportsPairs(bootstrap?.schemaVersion) || (pairState === 'ready' && (comparisonPairs.length === 0 || comparisonPairs.some((pair) => pair.id === selectedPairId))));

  useEffect(() => {
    reviewMounted.current = true;
    return () => { reviewMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!run || busy || !resultRequested.current) return;
    resultRequested.current = false;
    const target = main.current?.querySelector<HTMLElement>('#signal-result');
    if (main.current && target) revealEvidenceTarget(main.current, target);
  }, [run, busy]);

  const recoverError = useCallback((failure: unknown) => {
    setQuestion(null);
    setError(message(failure));
    if (failure instanceof SignalApiError && ['401', '403'].includes(failure.code)) {
      setBootstrap(null); setRuns([]); setRun(null);
    }
  }, []);

  const loadComparisonPairs = useCallback(async (watch: Watch | undefined, version: Bootstrap['schemaVersion']) => {
    const current = ++pairRevision.current;
    setComparisonPairs([]); setSelectedPairId('');
    if (!watch || !supportsPairs(version)) { setPairState('ready'); return; }
    setPairState('loading');
    try {
      const loaded = await api.comparisonPairs(watch);
      if (current !== pairRevision.current) return;
      if (loaded.schemaVersion !== comparisonPairsVersion(version)) throw new ContractError();
      setComparisonPairs(loaded.comparisonPairs); setPairState('ready');
    } catch (failure) {
      if (current === pairRevision.current) {
        setPairState('error');
        if (failure instanceof SignalApiError && ['401', '403'].includes(failure.code)) recoverError(failure);
      }
    }
  }, [api, recoverError]);

  useEffect(() => {
    if (developmentMode) return;
    const syncPending = () => setPendingRequest(pendingRequestFromBrowser(developmentMode));
    window.addEventListener('storage', syncPending);
    return () => window.removeEventListener('storage', syncPending);
  }, [developmentMode]);

  useEffect(() => {
    let active = true;
    const current = ++revision.current;
    void api.bootstrap().then(async (loaded) => {
      const storedId = selectedRunId();
      let saved: Run | null = null;
      let savedError = '';
      if (storedId) {
        try { saved = await api.run(storedId); }
        catch (failure) { savedError = message(failure); }
      }
      const pending = pendingRequestFromBrowser(developmentMode);
      const savedWatchListed = saved !== null && loaded.watches.some((watch) => watch.id === saved?.watchId);
      const initialWatch = (savedWatchListed ? saved?.watchId : null) ?? (pending !== 'unavailable' ? pending.find((item) => loaded.watches.some((watch) => watch.id === item.watchId))?.watchId : null) ?? loaded.watches[0]?.id ?? '';
      if (!active || current !== revision.current) return;
      setPendingRequest(pending);
      setBootstrap(loaded); setWatchId(initialWatch); setRuns(saved && savedWatchListed ? [saved] : []); setRun(saved); setHistoryState(initialWatch ? 'loading' : 'ready');
      void loadComparisonPairs(loaded.watches.find((watch) => watch.id === initialWatch), loaded.schemaVersion);
      saveRunLocation(saved?.id ?? null);
      if (savedError) setError(savedError);
      setNotice(savedError ? '指定された保存結果は取得できません。現在の登録済み条件と保留情報は保持しています。AIは実行していません。' : saved && !savedWatchListed ? '指定された保存結果を閲覧しています。この結果の条件は現在の登録範囲に含まれないため、その条件の履歴は自動取得しません。現在の登録済み条件を選び、別の確認として明示的に実行できます。' : pending === 'unavailable' ? '保留情報を確認できません。保存結果は閲覧できますが、新しい実行は開始しません。' : pending.length > 0 ? '前の実行要求を保持しています。同じ確認条件では状態の確認が必要です。別の登録済み条件は、選んで明示的に実行できます。' : '保存された条件と履歴を読み込みました。更新を確認すると新しい確認処理を開始します。');
      if (!initialWatch) return;
      try {
        const history = await api.runs(initialWatch);
        if (!active || current !== revision.current) return;
        const selected = saved ?? history[0] ?? null;
        setRuns(saved && savedWatchListed ? [saved, ...history.filter((item) => item.id !== saved.id)] : history); setRun(selected); setHistoryState('ready');
        saveRunLocation(selected?.id ?? null);
      } catch (failure) {
        if (!active || current !== revision.current) return;
        setHistoryState('error'); recoverError(failure);
        setNotice(saved ? '保存結果は取得しましたが、履歴一覧の取得には失敗しました。「履歴を再取得」で確認してください。AIは実行していません。' : '保存履歴を取得できません。「履歴を再取得」で確認してください。AIは実行していません。');
      }
    }).catch((failure: unknown) => { if (active && current === revision.current) { setError(message(failure)); setNotice('読込に失敗しました。'); } });
    return () => { active = false; revision.current += 1; pairRevision.current += 1; };
  }, [api, developmentMode, loadComparisonPairs, recoverError]);

  useEffect(() => {
    if (reviewRequests.current.api !== api || reviewRequests.current.developmentMode !== developmentMode) {
      reviewRequests.current = { api, developmentMode, requests: new Map<string, ReviewRequest>(), latest: new Map<string, string>() };
      setReviewDisplay({ api, developmentMode, reviews: {} });
    }
    if (!run) return;
    const context = reviewRequests.current;
    const key = runReviewKey(run);
    const requestKey = reviewRequestKey(run);
    context.latest.set(key, requestKey);
    if (!context.requests.has(requestKey)) {
      setReviewDisplay((previous) => withReview(previous, api, developmentMode, key, { status: 'loading' }));
      const readReview = api.review;
      const request = readReview && !developmentMode
        ? Promise.resolve().then(() => readReview(run)).then((review): RunReviewState => ({ status: 'ready', review: decodeRunReview({ schemaVersion: '1.0.0', runId: run.id, review }, run) })).catch((): RunReviewState => ({ status: 'unavailable' }))
        : Promise.resolve<RunReviewState>({ status: 'unavailable' });
      const entry: ReviewRequest = { promise: request, settled: false };
      context.requests.set(requestKey, entry);
      // 別の結果へ移動しても、その履歴行のレビューは確定できる。表示中の結果へは混ぜない。
      void request.then((state) => {
        entry.settled = true;
        if (reviewMounted.current && reviewRequests.current === context && context.requests.get(requestKey) === entry && context.latest.get(key) === requestKey) {
          setReviewDisplay((previous) => withReview(previous, api, developmentMode, key, state));
        }
      });
    }
    // レビュー取得の失敗は、保存結果・進行状態・保留要求の回復とは独立して扱う。
  }, [api, run, developmentMode, reviewRevision]);

  const loadHistory = async (id: string, preserveRun = false, pendingToRecover?: PendingRunRequest) => {
    const reviewContext = reviewRequests.current;
    const settledReviews = new Map([...reviewContext.requests].filter(([, entry]) => entry.settled));
    setQuestion(null);
    const current = ++revision.current;
    setError(''); setHistoryState('loading'); setNotice('保存履歴を読み込んでいます。AIは実行しません。');
    let recovered: Run | null = null;
    try {
      let lookupError = '';
      const pendingLookup = pendingToRecover ?? (pendingRequest !== 'unavailable' ? pendingRequest.find((item) => item.watchId === id) : undefined);
      if (pendingLookup) {
        try {
          const saved = await api.requestRun(id, pendingLookup.requestId);
          recovered = saved;
          if (current !== revision.current) return;
          setPendingRequest(pendingRequestFromBrowser(developmentMode));
          setRun(saved); setRuns((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]); saveRunLocation(saved.id);
          if (watchId !== id) {
            setWatchId(id);
            void loadComparisonPairs(bootstrap?.watches.find((watch) => watch.id === id), bootstrap?.schemaVersion ?? '1.0.0');
          }
          setNotice(`要求に対応する保存結果を表示しました。${runStatusLabel(saved)}。AIは実行していません。`);
        }
        catch (failure) { lookupError = message(failure); }
      }
      const history = await api.runs(id);
      if (current !== revision.current) return;
      const recoveredRun = recovered;
      const selected = recoveredRun ? history.find((item) => item.id === recoveredRun.id) ?? recoveredRun : (preserveRun ? history.find((item) => item.id === run?.id) ?? history[0] ?? null : history[0] ?? null);
      const selectedReviewKey = selected ? reviewRequestKey(selected) : null;
      if (selectedReviewKey && reviewRequests.current === reviewContext
        && settledReviews.has(selectedReviewKey) && reviewContext.requests.get(selectedReviewKey) === settledReviews.get(selectedReviewKey)) {
        reviewContext.requests.delete(selectedReviewKey);
        setReviewRevision((previous) => previous + 1);
      }
      const pending = pendingRequestFromBrowser(developmentMode);
      setPendingRequest(pending);
      setRuns(recovered && selected ? [selected, ...history.filter((item) => item.id !== selected.id)] : history); setHistoryState('ready'); setRun(selected); saveRunLocation(selected?.id ?? null);
      if (lookupError) setError(lookupError);
      setNotice(pending === 'unavailable' || pending.some((item) => item.watchId === id) ? '保存履歴を再取得しました。この条件の前の実行要求の成否はまだ確定していません。要求を再送せず、状態を確認してください。AIは実行していません。' : '保存履歴を再取得しました。AIは実行していません。');
    } catch (failure) { if (current === revision.current) {
      setHistoryState('error'); recoverError(failure);
      if (recovered) setNotice('要求に対応する保存結果は取得しましたが、履歴一覧の再取得には失敗しました。AIは実行していません。');
    } }
  };
  const recoverPending = async (pending: PendingRunRequest) => {
    if (!bootstrap || mutation.current || actionPending) return;
    setQuestion(null);
    if (bootstrap.watches.some((watch) => watch.id === pending.watchId)) {
      await loadHistory(pending.watchId, true, pending);
      return;
    }
    // 現在の登録範囲外は明示GETだけ。現在の選択・catalog・結果を置き換えない。
    mutation.current = true; setBusy(true); setError('');
    try {
      await api.requestRun(pending.watchId, pending.requestId);
      setPendingRequest(pendingRequestFromBrowser(developmentMode));
      setNotice('別の確認条件の保存状態を取得しました。現在選択中の条件と結果は保持しています。AIは実行していません。');
    } catch (failure) {
      setError(message(failure));
      setNotice('現在の登録範囲外の実行要求は確認できていません。保留情報を保持しています。現在の登録済み条件は引き続き選べます。要求は再送していません。');
    } finally { mutation.current = false; setBusy(false); }
  };
  const changeWatch = (id: string) => {
    setQuestion(null);
    setWatchId(id); setRun(null); setRuns([]); setShowAnalysis(false); saveRunLocation(null);
    void loadComparisonPairs(bootstrap?.watches.find((watch) => watch.id === id), bootstrap?.schemaVersion ?? '1.0.0');
    void loadHistory(id);
  };
  const selectRun = async (id: string) => {
    if (historyState === 'loading') return;
    setQuestion(null);
    const current = ++revision.current;
    setError(''); setNotice('保存結果を再取得しています。');
    try {
      const selected = await api.run(id);
      if (current !== revision.current) return;
      if (selected.watchId !== watchId) throw new ContractError();
      setQuestion(null);
      setRun(selected); saveRunLocation(selected.id); setNotice('保存結果を表示しました。AIは実行していません。');
    } catch (failure) { if (current === revision.current) recoverError(failure); }
  };
  const saveWatch = async (input: WatchInput) => {
    if (!bootstrap || mutation.current || historyState === 'loading' || pendingRequest === 'unavailable') return;
    setQuestion(null);
    mutation.current = true; revision.current += 1; setBusy(true); setError('');
    try {
      const saved = await api.saveWatch(input, bootstrap.csrfToken);
      setBootstrap({ ...bootstrap, watches: [...bootstrap.watches, saved] });
      setWatchId(saved.id); setRuns([]); setRun(null); setHistoryState('ready'); setShowCreate(false); saveRunLocation(null);
      void loadComparisonPairs(saved, bootstrap.schemaVersion);
      setNotice(questionSupported ? '確認条件を保存しました。問いと比較組を選び、「この問いで分析を開始」で確認できます。' : developmentMode ? '架空の確認条件をこのブラウザーに保存しました。「更新を確認」で比較例を表示できます。' : '確認条件をバックエンドへ保存しました。「更新を確認」で開始できます。');
    } catch (failure) { recoverError(failure); }
    finally { mutation.current = false; setBusy(false); }
  };
  const startRun = async (intent: 'check' | 'reanalyze') => {
    if (!bootstrap || !selectedWatch || mutation.current || historyState === 'loading' || selectedWatchPending || !selectionReady) return;
    const selectedQuestion = questionSupported && question ? analysisQuestion(question) : undefined;
    setQuestion(null);
    const comparisonPairId = supportsPairs(bootstrap.schemaVersion) ? selectedPairId : '';
    mutation.current = true; revision.current += 1; setBusy(true); setError('');
    setNotice(selectedQuestion ? `「${selectedQuestion.text}」を${developmentMode ? '架空の固定結果で確認・ローカル保存しています。実AIは実行しません。' : '選んだ資料で確認しています。回答と根拠を同じ実行に保存します。'}` : developmentMode ? '架空の固定結果を表示・保存しています。実AIによる生成は行いません。' : '選んだ資料の差分と根拠を確認しています。実施できた分析と未確認事項は結果に表示します。');
    try {
      const saved = await api.start(watchId, intent, crypto.randomUUID(), bootstrap.csrfToken, comparisonPairId || undefined, selectedQuestion);
      const savedQuestion = saved.schemaVersion === '2.5.0' ? saved.input.analysisQuestion : undefined;
      const savedPairId = saved.schemaVersion === '2.2.0' || saved.schemaVersion === '2.3.0' || saved.schemaVersion === '2.5.0' ? saved.input.comparisonPair?.id : undefined;
      if (saved.watchId !== watchId || !sameAnalysisQuestion(savedQuestion, selectedQuestion) || (supportsPairs(bootstrap.schemaVersion) && savedPairId !== (comparisonPairId || undefined))) throw new ContractError();
      resultRequested.current = true;
      setPendingRequest(pendingRequestFromBrowser(developmentMode));
      setRun(saved); setRuns((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]); setHistoryState('ready'); saveRunLocation(saved.id);
      setNotice(`確認結果を表示しました。${runStatusLabel(saved)}。`);
    } catch (failure) {
      setPendingRequest(pendingRequestFromBrowser(developmentMode)); recoverError(failure);
      setNotice(failure instanceof SignalApiError && failure.preAdmissionRejected
        ? `今回の要求は受付前に拒否されました。${failure.message}自動では再送しません。`
        : failure instanceof SignalApiError && failure.requestNotSent
          ? '今回の新しい要求は送信していません。対応ブラウザーで開き直し、保存履歴から確認できます。自動では再送しません。'
        : '通信または確認処理が完了していません。要求を再送せず、保存履歴で状態を確認してください。');
    }
    finally { mutation.current = false; setBusy(false); }
  };
  const refreshDatasets = async () => {
    if (mutation.current || actionPending) return;
    setQuestion(null);
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
    <main ref={main} id="signal-main" className="signal-main" onClick={revealEvidenceLink}>
      <SignalPurposeIntro />
      <SignalValuePreview />
      <SignalQuestionPicker selected={question} disabled={actionPending || !bootstrap} analysisSupported={questionSupported} developmentMode={developmentMode} onSelect={(selected) => {
        setQuestion(selected);
        const target = main.current?.querySelector<HTMLElement>('#signal-conditions');
        if (main.current && target) revealEvidenceTarget(main.current, target);
      }} />
      <div className="signal-data-banner">保存結果のデータ区分は、各実行に保存された情報で表示します。<span>常時監視・自動通知ではありません。</span></div>
      <p className="signal-live" role="status" aria-live="polite">{notice}</p>
      {error ? <div className="signal-error" role="alert"><p>{error}</p>{!bootstrap ? <button type="button" className="signal-button" onClick={() => window.location.reload()}>{developmentMode ? 'ローカル保存を確認して再読み込み' : '認証・設定を確認して再読み込み'}</button> : null}</div> : null}
      {pendingRequest === 'unavailable' ? <PendingRunNotice pending={pendingRequest} busy={actionPending || !bootstrap} onRecover={() => {}} /> : pendingRequest.map((pending) => <PendingRunNotice key={`${pending.watchId}:${pending.requestId}`} pending={pending} outsideScope={!bootstrap?.watches.some((watch) => watch.id === pending.watchId)} busy={actionPending || !bootstrap} onRecover={() => void recoverPending(pending)} />)}
      {bootstrap ? <div className="signal-layout">
        <aside className="signal-sidebar" aria-label="保存条件と履歴">
          <section className="signal-panel" id="signal-conditions" tabIndex={-1}><p className="signal-eyebrow">2 · 対象資料を確認</p><h2>{bootstrap.analysisMode === 'facts_only' ? 'どの企業・書誌事項を確かめる？' : 'どの企業・図面を確かめる？'}</h2>
            <p className="signal-subtle">保存した確認条件から、企業と対象資料を選びます。</p>
            <AnalysisModeNotice bootstrap={bootstrap} developmentMode={developmentMode} />
            <p className="signal-subtle">{bootstrap.catalog.entities.length === 1 ? '現在の登録対象は1社です。この企業の収録範囲を確認します。' : `現在の登録対象は${bootstrap.catalog.entities.length}社です。登録された企業・商品分野だけを選択できます。`}</p>
            {bootstrap.watches.length ? <label className="signal-field">確認する条件<select value={watchId} disabled={busy} onChange={(event) => changeWatch(event.target.value)}>{bootstrap.watches.map((watch) => <option key={watch.id} value={watch.id}>{watch.name}</option>)}</select></label> : <p>最初の確認条件を保存してください。</p>}
            {selectedWatch ? <><WatchSummary watch={selectedWatch} bootstrap={bootstrap} />{supportsPairs(bootstrap.schemaVersion) ? <ComparisonPairSelector pairs={comparisonPairs} state={pairState} selectedId={selectedPairId} busy={actionPending} onSelect={setSelectedPairId} onReload={() => void loadComparisonPairs(selectedWatch, bootstrap.schemaVersion)} /> : null}<SignalStartGuide analysisMode={bootstrap.analysisMode} developmentMode={developmentMode} questionSupported={questionSupported} questionText={questionSupported && question ? analysisQuestion(question).text : undefined} />{questionSupported && !question ? <p className="signal-subtle">先に分析する問いを選んでください。今見ている保存結果の目的は変更しません。</p> : null}<button className="signal-button signal-primary" aria-describedby="signal-start-explanation" type="button" disabled={creationPending || selectedWatchPending || !selectionReady || (run?.watchId === watchId && run.status === 'running')} onClick={() => void startRun('check')}>{busy ? '確認しています…' : questionSupported ? 'この問いで分析を開始' : '更新を確認'}</button><p className="signal-subtle">{questionSupported ? '同じ問い・資料・版の確認済み結果がある場合は、その保存結果を表示します。問い・比較組の選択や変更だけではAIを実行しません。' : supportsPairs(bootstrap.schemaVersion) ? '同じ条件・同じデータ・同じ比較組の確認済み結果がある場合は、保存結果を表示します。比較組の選択や変更だけではAIを実行しません。' : '同じ条件・同じデータの確認済み結果がある場合は、保存結果を表示します。'}</p></> : null}
            {selectedWatch ? <button className="signal-text-button" type="button" disabled={actionPending} onClick={() => void refreshDatasets()}>同じ企業・商品条件で収録データを選び直す</button> : null}
            <button className="signal-text-button" type="button" disabled={creationPending} aria-expanded={showCreate} onClick={() => setShowCreate(!showCreate)}>{showCreate ? '条件の作成を閉じる' : '＋ 確認条件を保存'}</button>
            {showCreate || !bootstrap.watches.length ? <WatchForm key={`${selectedWatch?.id ?? 'new'}-${createRevision}`} bootstrap={bootstrap} seed={selectedWatch} busy={creationPending} onSave={saveWatch} /> : null}
          </section>
          <section className="signal-panel"><h2>保存履歴</h2><button className="signal-text-button" type="button" disabled={busy || !watchId} onClick={() => void loadHistory(watchId, true)}>履歴を再取得</button>
            <SignalHistory runs={runs} selectedId={run?.id} state={historyState} disabled={actionPending} onSelect={(id) => void selectRun(id)} reviews={currentReviews} />
            {run && run.watchId === watchId && run.status !== 'running' ? <details className="signal-details"><summary>新しい実行として確認し直す</summary><p className="signal-subtle">{developmentMode ? '過去の比較例を残して、架空資料の模擬結果を新しくローカル保存します。実AIは実行しません。' : bootstrap.analysisMode === 'facts_only' ? '過去の結果を残して、登録済み書誌事項を新しい実行として再比較します。記事取得・AI呼出は行いません。' : bootstrap.analysisMode === 'standard' ? '過去の結果を残して、登録資料による分析を新しく実行します。AI・公式確認を含む場合があります。' : '過去の結果を残して、新しい確認処理を実行します。この接続先の分析モードは未記録です。'}</p><button className="signal-button" type="button" disabled={creationPending || selectedWatchPending || !selectionReady} onClick={() => void startRun('reanalyze')}>別の実行として再確認</button></details> : null}
          </section>
        </aside>
        <div className="signal-content">{run ? <><SignalQuestionFocus question={questionSupported ? null : question} hasEvidence={run.signal !== null} /><SignalResult key={run.id} run={run} developmentMode={developmentMode} reviewState={currentReviews[runReviewKey(run)]} /></> : <SignalEmptyJourney developmentMode={developmentMode} factsOnly={bootstrap.analysisMode === 'facts_only'} questionSupported={questionSupported} />}</div>
      </div> : null}
      {renderAnalysis && selectedWatch ? <section className="signal-legacy"><button className="signal-text-button" type="button" disabled={busy} aria-expanded={showAnalysis} onClick={() => setShowAnalysis(!showAnalysis)}>既存の市場・企業ルール分析 {showAnalysis ? 'を閉じる' : 'を開く'}</button>{showAnalysis ? renderAnalysis(selectedWatch.afterDatasetId) : null}</section> : null}
    </main><footer className="signal-footer">参考情報です。収録範囲外や最新の法的状態は示しません。事実・AI観察候補・関連仮説を区別して確認してください。</footer>
  </div>;
}

export function PendingRunNotice({ pending, outsideScope = false, busy, onRecover }: { pending: PendingRunRequest | 'unavailable'; outsideScope?: boolean; busy: boolean; onRecover: () => void }) {
  return <div className="signal-error" role="status"><p>{pending === 'unavailable' ? '実行要求の保留情報を確認できません。ブラウザの保存設定を管理者と確認してください。保存結果は閲覧できますが、新しい実行は開始しません。' : outsideScope ? '現在の登録範囲に含まれない条件の実行要求を保持しています。成否は未確認です。別の登録済み条件は明示的に実行できます。この要求は自動照会・再送しません。' : 'この確認条件の前の実行要求の成否を確認するまで、同じ条件で新しい実行を開始しません。保存結果の閲覧や再読み込みから要求を再送することはありません。'}</p>{pending !== 'unavailable' ? <button className="signal-button" type="button" disabled={busy} onClick={onRecover}>保留した実行の状態を確認</button> : null}</div>;
}

export function AnalysisModeNotice({ bootstrap, developmentMode = false }: { bootstrap: Bootstrap; developmentMode?: boolean }) {
  return <p className="signal-mode-note">{developmentMode ? <><strong>架空資料の比較例</strong><br />このブラウザーのローカル保存だけを使います。実AI・公式サイト取得・永続DBには接続しません。</> : bootstrap.analysisMode === 'facts_only' ? <><strong>書誌情報のみの比較</strong><br />画像/記事分析は未実施となります。「更新を確認」では登録済み書誌事項を比較し、画像・記事取得やAI呼出は行いません。</> : bootstrap.analysisMode === 'standard' ? <><strong>登録資料を使う分析</strong><br />画像観察と公式情報の照合に対応する経路です。今回の入力で実施できた内容は保存結果に示します。</> : <>この接続先の分析モードは未記録です。過去の保存結果や比較組の有無からは推測しません。</>}</p>;
}

export function SignalStartGuide({ analysisMode, developmentMode = false, questionText, questionSupported = false }: { analysisMode: Bootstrap['analysisMode']; developmentMode?: boolean; questionText?: string; questionSupported?: boolean }) {
  const outcome = analysisMode === 'facts_only' && !developmentMode ? '書誌事項・参照先・次の確認を見る' : '図面・引用・次の確認を見る';
  return <div className="signal-start-guide"><p className="signal-eyebrow">3 · 明示的に開始</p><p><strong>条件・比較A/Bの資料を選ぶ →「{questionSupported || questionText ? 'この問いで分析を開始' : '更新を確認'}」で開始 → {outcome}</strong></p><p id="signal-start-explanation" className="signal-subtle">{questionText ? <>次の実行で確かめる問い：<strong>{questionText}</strong>。問いはこの開始時点で保存します。</> : null}{developmentMode ? 'このボタンで架空の比較例を表示し、このブラウザーに保存します。実AIの実行や課金はありません。' : analysisMode === 'facts_only' ? 'このボタンで登録済みの書誌事項を比較します。画像・記事取得やAI呼出は行いません。' : analysisMode === 'standard' ? '保存済みの同条件の結果がなければ、資料の確認・AI分析を含む新しい処理を開始します。選択・履歴閲覧・再読み込みだけでは開始しません。' : '新しい確認処理はこのボタンで開始します。分析モードは未記録です。選択・履歴閲覧・再読み込みだけでは開始しません。'}</p></div>;
}

export function ComparisonPairSelector({ pairs, state, selectedId, busy, onSelect, onReload }: { pairs: ComparisonPair[]; state: PairState; selectedId: string; busy: boolean; onSelect: (id: string) => void; onReload: () => void }) {
  const selected = pairs.find((pair) => pair.id === selectedId);
  return <div className="signal-pair-selector"><p className="signal-subtle">次の実行で使う登録済み比較組を選択します。閲覧中の保存結果は変わりません。</p>
    {state === 'loading' ? <p role="status">比較組の候補を読み込んでいます。</p> : null}
    {state === 'error' ? <div role="alert" className="signal-error"><p>比較組の候補を確認できません。実行前に再取得してください。</p><button className="signal-button" type="button" disabled={busy} onClick={onReload}>比較組を再取得</button></div> : null}
    {state === 'ready' && pairs.length === 0 ? <p className="signal-subtle">この条件で選択できる比較組はありません。画像がない結果も保存できます。</p> : null}
    {state === 'ready' && pairs.length > 0 ? <label className="signal-field">次の実行に使う比較組<select value={selectedId} required disabled={busy} onChange={(event) => onSelect(event.target.value)}><option value="">比較組を選択してください</option>{pairs.map((pair) => <option key={pair.id} value={pair.id}>{pair.label}</option>)}</select></label> : null}
    {selected ? <dl className="signal-metadata"><div><dt>登録時の比較条件・根拠</dt><dd>{selected.evidence}</dd></div>{selected.media.map((media) => <div key={media.id}><dt>{media.role === 'comparisonA' ? '比較A' : '比較B'}の対象</dt><dd>{media.label}<small>{media.view ?? '方向不明'} · {comparisonStatusLabel(media.comparisonStatus)}</small></dd></div>)}</dl> : null}
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
  return <form className="signal-watch-form" onSubmit={onSubmit}><h3>新しい確認条件</h3><p className="signal-subtle">登録済みの収録データを明示的に選びます。保存後に画面の案内に沿って対象を選び、開始ボタンを押してください。元の条件と保存結果は残ります。</p><label className="signal-field">条件名<input name="name" required maxLength={120} defaultValue={seed ? `${Array.from(seed.name).slice(0, 110).join('')}（データ更新）` : '商品の変化を確認'} disabled={busy} /></label><label className="signal-field">企業候補<select name="entityId" required disabled={busy} defaultValue={seed?.entityId}>{entities.map((item) => <option key={item.id} value={item.id}>{item.name ?? '企業名不明'}</option>)}</select></label><label className="signal-field">商品カテゴリー / 分類<select name="categoryId" required disabled={busy} defaultValue={seed?.categoryId}>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="signal-field">比較Aの収録データ<select name="beforeDatasetId" required disabled={busy} defaultValue={seed?.beforeDatasetId ?? orderedDatasets[0]?.id}>{orderedDatasets.map((item) => <option key={item.id} value={item.id}>{item.dataAsOf} · {item.coverage}{item.dataMode ? ` · ${dataModeLabel(item.dataMode)}` : ''}</option>)}</select></label><label className="signal-field">比較Bの収録データ<select name="afterDatasetId" required disabled={busy} defaultValue={seed?.afterDatasetId ?? orderedDatasets[orderedDatasets.length - 1]?.id}>{orderedDatasets.map((item) => <option key={item.id} value={item.id}>{item.dataAsOf} · {item.coverage}{item.dataMode ? ` · ${dataModeLabel(item.dataMode)}` : ''}</option>)}</select></label><label className="signal-field">登録した参照先<select name="sourceProfileId" required disabled={busy} defaultValue={seed?.sourceProfileId}>{sourceProfiles.map((item) => <option key={item.id} value={item.id}>{item.label}{item.dataMode ? ` · ${dataModeLabel(item.dataMode)}` : ''}</option>)}</select></label><button className="signal-button" type="submit" disabled={busy}>この条件を保存</button></form>;
}

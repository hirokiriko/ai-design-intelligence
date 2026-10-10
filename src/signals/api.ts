import { ContractError, decodeBootstrap, decodeComparisonPairs, decodeRun, decodeRuns, decodeWatch, type Run, type Watch, type WatchInput } from './contract';
import { ANALYSIS_QUESTION_VERSION, analysisQuestion, isAnalysisQuestion, sameAnalysisQuestion, type AnalysisQuestion } from './analysis-question';
import { decodeRunReview } from './run-review';

export class SignalApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly preAdmissionRejected = false, public readonly requestNotSent = false, public readonly bootstrapQueryRejected = false) { super(message); }
}
export interface PendingRunRequest { watchId: string; requestId: string; analysisQuestion?: AnalysisQuestion; comparisonPairId?: string }
const pendingRequestKey = 'kiriko-design-signals-pending-request';
const pendingRequestPrefix = `${pendingRequestKey}:`;
const pendingRequestLock = 'kiriko-design-signals-pending-request-lock';
const pendingMessage = 'この確認条件の前の実行要求の成否を確認できていません。保存履歴で状態を確認するまで、この条件で新しい実行を開始しません。';
function pendingStorageError(): SignalApiError {
  return new SignalApiError('pending-storage', '実行要求の保留情報を確認できません。ブラウザの保存設定を管理者と確認してください。保存結果は閲覧できますが、新しい実行は開始しません。');
}
function pendingLockError(requestNotSent: boolean): SignalApiError {
  return new SignalApiError('pending-lock', '実行要求の保留情報を安全に更新できません。このブラウザーでは新しい実行を開始せず、保存結果の閲覧を続けられます。', false, requestNotSent);
}
// 同じ現行protocolのタブ間で、保留情報の比較と更新を排他する。通信はlock外。
async function withPendingRequestLock<T>(update: () => T, requestNotSent = false): Promise<T> {
  if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') throw pendingLockError(requestNotSent);
  try {
    return await navigator.locks.request(pendingRequestLock, { mode: 'exclusive' }, update);
  } catch (failure) {
    if (failure instanceof SignalApiError) throw failure;
    throw pendingLockError(requestNotSent);
  }
}
function requestStorageKey(watchId: string, requestId: string): string {
  return `${pendingRequestPrefix}${encodeURIComponent(watchId)}:${requestId}`;
}
function parsePending(value: string): PendingRunRequest {
  const pending: unknown = JSON.parse(value);
  if (typeof pending !== 'object' || pending === null || Array.isArray(pending)
    || !('watchId' in pending) || !('requestId' in pending)
    || typeof pending.watchId !== 'string' || typeof pending.requestId !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(pending.watchId)
    || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(pending.requestId)) throw pendingStorageError();
  const item = pending as Record<string, unknown>;
  const keys = Object.keys(item);
  if (keys.length === 2 && keys.every((key) => ['watchId', 'requestId'].includes(key))) return { watchId: pending.watchId, requestId: pending.requestId };
  if (!isAnalysisQuestion(item.analysisQuestion) || keys.some((key) => !['watchId', 'requestId', 'analysisQuestion', 'comparisonPairId'].includes(key))
    || keys.length !== (Object.prototype.hasOwnProperty.call(item, 'comparisonPairId') ? 4 : 3)
    || (Object.prototype.hasOwnProperty.call(item, 'comparisonPairId') && (typeof item.comparisonPairId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(item.comparisonPairId)))) throw pendingStorageError();
  return { watchId: pending.watchId, requestId: pending.requestId, analysisQuestion: analysisQuestion(item.analysisQuestion.id), ...(typeof item.comparisonPairId === 'string' ? { comparisonPairId: item.comparisonPairId } : {}) };
}
function samePending(left: PendingRunRequest, right: PendingRunRequest): boolean {
  return left.watchId === right.watchId && left.requestId === right.requestId
    && sameAnalysisQuestion(left.analysisQuestion, right.analysisQuestion) && left.comparisonPairId === right.comparisonPairId;
}
function validateRequestRun(run: Run, snapshot: PendingRunRequest, comparePair = true): void {
  if (run.watchId !== snapshot.watchId || !sameAnalysisQuestion(run.schemaVersion === '2.5.0' ? run.input.analysisQuestion : null, snapshot.analysisQuestion)) throw new ContractError();
  if (comparePair && (run.schemaVersion === '2.2.0' || run.schemaVersion === '2.3.0' || run.schemaVersion === '2.5.0' ? run.input.comparisonPair?.id : undefined) !== snapshot.comparisonPairId) throw new ContractError();
}
// legacy単一keyは移行・上書きしない。別条件の未知結果も独立して保持する。
export function readPendingRunRequests(): PendingRunRequest[] {
  try {
    const legacy = localStorage.getItem(pendingRequestKey);
    const pending = legacy === null ? [] : [parsePending(legacy)];
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(pendingRequestPrefix)) keys.push(key);
    }
    for (const key of keys.sort()) {
      const value = localStorage.getItem(key);
      if (value === null) continue;
      const item = parsePending(value);
      if (key !== requestStorageKey(item.watchId, item.requestId)) throw pendingStorageError();
      const duplicate = pending.find((entry) => entry.watchId === item.watchId && entry.requestId === item.requestId);
      if (duplicate && !samePending(duplicate, item)) throw pendingStorageError();
      if (!duplicate) pending.push(item);
    }
    return pending;
  } catch { throw pendingStorageError(); }
}
export function readPendingRunRequest(watchId?: string): PendingRunRequest | null {
  return readPendingRunRequests().find((pending) => watchId === undefined || pending.watchId === watchId) ?? null;
}
function clearPendingRunRequest(watchId: string, requestId: string, expected?: PendingRunRequest): Promise<void> {
  return withPendingRequestLock(() => {
    // 比較とmatching keyだけの解除を、全現行mutatorの同じ排他内で行う。
    try {
      const matchingKeys: string[] = [];
      for (const key of [pendingRequestKey, requestStorageKey(watchId, requestId)]) {
        const value = localStorage.getItem(key);
        if (value === null) continue;
        const pending = parsePending(value);
        if (pending.watchId === watchId && pending.requestId === requestId) {
          if (expected && !samePending(pending, expected)) throw pendingStorageError();
          matchingKeys.push(key);
        }
      }
      for (const key of matchingKeys) localStorage.removeItem(key);
    } catch { throw pendingStorageError(); }
  });
}
function reservePendingRunRequest(snapshot: PendingRunRequest): Promise<void> {
  const { watchId, requestId } = snapshot;
  return withPendingRequestLock(() => {
    if (readPendingRunRequest(watchId)) throw new SignalApiError('pending', pendingMessage, false, true);
    // 保存するのは識別子だけ。読み戻せない場合はPOSTしない。
    try {
      const key = requestStorageKey(watchId, requestId);
      localStorage.setItem(key, JSON.stringify(snapshot));
      const value = localStorage.getItem(key);
      const pending = value === null ? null : parsePending(value);
      if (!pending || !samePending(pending, snapshot)) throw pendingStorageError();
    } catch { throw pendingStorageError(); }
  }, true);
}
async function preAdmissionRejectionMessage(response: Response, selectedQuestionRequest = false): Promise<string | null> {
  if (!(selectedQuestionRequest ? [400, 422, 409, 503] : [409, 503]).includes(response.status)
    || !/^application\/json(?:;|$)/i.test(response.headers.get('Content-Type') ?? '')) return null;
  try {
    const text = await response.text();
    if (text.length > 4096) return null;
    const body: unknown = JSON.parse(text);
    if (typeof body !== 'object' || body === null || Object.keys(body).length !== 2
      || !('schemaVersion' in body) || body.schemaVersion !== '2.3.0' || !('error' in body)
      || typeof body.error !== 'object' || body.error === null || Object.keys(body.error).length !== 1
      || !('code' in body.error)) return null;
    if (selectedQuestionRequest && response.status === 400 && body.error.code === 'INVALID_ANALYSIS_QUESTION') {
      return '選択した質問を受け付けられませんでした。登録された質問を選び直してください。';
    }
    if (selectedQuestionRequest && response.status === 422 && body.error.code === 'ANALYSIS_QUESTION_UNAVAILABLE') {
      return 'この条件では選択した質問を利用できません。対応する比較組と質問を確認してください。';
    }
    if (response.status === 503 && body.error.code === 'RUNS_DISABLED') {
      return '新しい実行は現在停止しています。保存履歴は閲覧できます。再開後に改めて実行してください。';
    }
    if (response.status === 409 && body.error.code === 'RUN_IN_PROGRESS') {
      return '別の実行が処理中のため、今回の要求は受け付けていません。処理完了後に改めて実行してください。';
    }
  } catch { /* 不明な応答は受付前拒否として扱わず、固定メッセージだけを返す。 */ }
  return null;
}
async function isUnsupportedBootstrapQuery(response: Response): Promise<boolean> {
  if (response.status !== 400 || !/^application\/json(?:;|$)/i.test(response.headers.get('Content-Type') ?? '')) return false;
  try {
    const text = await response.text();
    if (text.length > 4096) return false;
    const body: unknown = JSON.parse(text);
    return typeof body === 'object' && body !== null && !Array.isArray(body) && Object.keys(body).length === 2
      && 'schemaVersion' in body && body.schemaVersion === '2.3.0' && 'error' in body
      && typeof body.error === 'object' && body.error !== null && !Array.isArray(body.error) && Object.keys(body.error).length === 1
      && 'code' in body.error && body.error.code === 'INVALID_REQUEST';
  } catch { return false; }
}
export async function requestJson(path: string, options: RequestInit = {}, selectedQuestionRequest = false): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { ...options, credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', ...options.headers }, signal: options.signal ?? AbortSignal.timeout(195000) });
  } catch { throw new SignalApiError('connection', '通信が完了していません。保存履歴を再取得して実行状態を確認してください。'); }
  if (!response.ok) {
    if (path === `/bootstrap?analysisQuestionVersion=${ANALYSIS_QUESTION_VERSION}` && await isUnsupportedBootstrapQuery(response.clone())) {
      throw new SignalApiError('400', 'このサーバーでは質問の対応確認を利用できません。', false, false, true);
    }
    const rejectionMessage = await preAdmissionRejectionMessage(response, selectedQuestionRequest);
    if (rejectionMessage) throw new SignalApiError(String(response.status), rejectionMessage, true);
    const messages: Record<number, string> = {
      400: '比較組または確認条件が一致しません。登録済みの候補を再取得してください。',
      401: '認証が必要です。管理者から案内された方法で認証し、再読み込みしてください。',
      403: '操作権限またはセッションを確認できません。再読み込みしてからやり直してください。',
      404: '保存結果または確認条件が見つかりません。',
      409: 'すでに実行中です。保存履歴から状態を再取得してください。',
      429: '実行回数または予算の上限に達しました。管理者に確認してください。',
      422: '比較組または確認条件を検証できません。登録済みの候補を再取得してください。',
    };
    throw new SignalApiError(String(response.status), messages[response.status] ?? '確認処理に失敗しました。保存済みの結果は履歴から再表示できます。');
  }
  if (!response.headers.get('Content-Type')?.includes('application/json')) throw new ContractError();
  const body = await response.text();
  if (body.length > 12_000_000) throw new ContractError();
  try { return JSON.parse(body) as unknown; } catch { throw new ContractError(); }
}
export const signalApi = {
  bootstrap: async () => {
    try { return decodeBootstrap(await requestJson(`/bootstrap?analysisQuestionVersion=${ANALYSIS_QUESTION_VERSION}`)); }
    catch (failure) {
      if (failure instanceof SignalApiError && failure.bootstrapQueryRejected) return decodeBootstrap(await requestJson('/bootstrap'));
      throw failure;
    }
  },
  comparisonPairs: async (watch: Watch) => decodeComparisonPairs(await requestJson(`/watches/${encodeURIComponent(watch.id)}/comparison-pairs`), watch),
  saveWatch: async (input: WatchInput, csrfToken: string) => decodeWatch(await requestJson('/watches', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(input) })),
  runs: async (watchId: string) => {
    const runs = decodeRuns(await requestJson(`/runs?watchId=${encodeURIComponent(watchId)}`));
    if (runs.some((run) => run.watchId !== watchId)) throw new ContractError();
    return runs;
  },
  run: async (runId: string) => {
    const run = decodeRun(await requestJson(`/runs/${encodeURIComponent(runId)}`));
    if (run.id !== runId) throw new ContractError();
    return run;
  },
  review: async (run: Run) => {
    const subject = { id: run.id, schemaVersion: run.schemaVersion, versions: { ...run.versions } };
    return decodeRunReview(await requestJson(`/runs/${encodeURIComponent(subject.id)}/review`), subject);
  },
  requestRun: async (watchId: string, requestId: string) => {
    const snapshot = readPendingRunRequests().find((pending) => pending.watchId === watchId && pending.requestId === requestId);
    const run = decodeRun(await requestJson(`/watches/${encodeURIComponent(watchId)}/requests/${encodeURIComponent(requestId)}`));
    if (run.watchId !== watchId) throw new ContractError();
    if (snapshot) validateRequestRun(run, snapshot, snapshot.analysisQuestion !== undefined);
    if (snapshot && run.status !== 'running') await clearPendingRunRequest(watchId, requestId, snapshot);
    return run;
  },
  start: async (watchId: string, intent: 'check' | 'reanalyze', requestId: string, csrfToken: string, comparisonPairId?: string, selectedQuestion?: AnalysisQuestion | null) => {
    const candidate = selectedQuestion == null ? null : { ...selectedQuestion };
    if (candidate !== null && !isAnalysisQuestion(candidate)) throw new SignalApiError('invalid-question', '登録された質問を選び直してください。', false, true);
    const question = candidate === null ? null : analysisQuestion(candidate.id);
    if (question && comparisonPairId !== undefined && (typeof comparisonPairId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(comparisonPairId))) throw new SignalApiError('invalid-question', '登録された比較組を選び直してください。', false, true);
    const snapshot: PendingRunRequest = { watchId, requestId, ...(question ? { analysisQuestion: question, ...(comparisonPairId ? { comparisonPairId } : {}) } : {}) };
    // 応答を失った場合も、再読み込み後に同じ要求をGETで確認する。結果・認証情報は保存しない。
    await reservePendingRunRequest(snapshot);
    try {
      const run = decodeRun(await requestJson(`/watches/${encodeURIComponent(watchId)}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ intent, requestId, ...(comparisonPairId ? { comparisonPairId } : {}), ...(question ? { analysisQuestionId: question.id, analysisQuestionVersion: question.version } : {}) }) }, question !== null));
      validateRequestRun(run, { ...snapshot, ...(comparisonPairId ? { comparisonPairId } : {}) }, question !== null || comparisonPairId !== undefined);
      if (run.status !== 'running') await clearPendingRunRequest(watchId, requestId, snapshot);
      return run;
    } catch (failure) {
      if (failure instanceof SignalApiError && (failure.preAdmissionRejected
        || (question === null && ['400', '401', '403', '404', '413', '422', '429'].includes(failure.code)))) await clearPendingRunRequest(watchId, requestId, snapshot);
      throw failure;
    }
  },
};
export type SignalApi = Omit<typeof signalApi, 'review'> & { review?: typeof signalApi.review };

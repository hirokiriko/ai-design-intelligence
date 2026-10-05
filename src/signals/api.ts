import { ContractError, decodeBootstrap, decodeComparisonPairs, decodeRun, decodeRuns, decodeWatch, type Watch, type WatchInput } from './contract';

export class SignalApiError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
export interface PendingRunRequest { watchId: string; requestId: string }
const pendingRequestKey = 'kiriko-design-signals-pending-request';
const pendingMessage = '前の実行要求の成否を確認できていません。保存履歴で状態を確認するまで、新しい実行を開始しません。';
function pendingStorageError(): SignalApiError {
  return new SignalApiError('pending-storage', '実行要求の保留情報を確認できません。ブラウザの保存設定を管理者と確認してください。保存結果は閲覧できますが、新しい実行は開始しません。');
}
export function readPendingRunRequest(): PendingRunRequest | null {
  try {
    const value = localStorage.getItem(pendingRequestKey);
    if (value === null) return null;
    const pending: unknown = JSON.parse(value);
    if (typeof pending !== 'object' || pending === null || Object.keys(pending).length !== 2
      || !('watchId' in pending) || !('requestId' in pending)
      || typeof pending.watchId !== 'string' || typeof pending.requestId !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(pending.watchId)
      || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(pending.requestId)) throw pendingStorageError();
    return { watchId: pending.watchId, requestId: pending.requestId };
  } catch { throw pendingStorageError(); }
}
function clearPendingRunRequest(watchId: string, requestId: string): void {
  const pending = readPendingRunRequest();
  if (pending?.watchId !== watchId || pending.requestId !== requestId) return;
  try { localStorage.removeItem(pendingRequestKey); } catch { throw pendingStorageError(); }
}
export async function requestJson(path: string, options: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { ...options, credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', ...options.headers }, signal: options.signal ?? AbortSignal.timeout(195000) });
  } catch { throw new SignalApiError('connection', '通信が完了していません。保存履歴を再取得して実行状態を確認してください。'); }
  if (!response.ok) {
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
  bootstrap: async () => decodeBootstrap(await requestJson('/bootstrap')),
  comparisonPairs: async (watch: Watch) => decodeComparisonPairs(await requestJson(`/watches/${encodeURIComponent(watch.id)}/comparison-pairs`), watch),
  saveWatch: async (input: WatchInput, csrfToken: string) => decodeWatch(await requestJson('/watches', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(input) })),
  runs: async (watchId: string) => decodeRuns(await requestJson(`/runs?watchId=${encodeURIComponent(watchId)}`)),
  run: async (runId: string) => decodeRun(await requestJson(`/runs/${encodeURIComponent(runId)}`)),
  requestRun: async (watchId: string, requestId: string) => {
    const run = decodeRun(await requestJson(`/watches/${encodeURIComponent(watchId)}/requests/${encodeURIComponent(requestId)}`));
    if (run.watchId !== watchId) throw new ContractError();
    if (run.status !== 'running') clearPendingRunRequest(watchId, requestId);
    return run;
  },
  start: async (watchId: string, intent: 'check' | 'reanalyze', requestId: string, csrfToken: string, comparisonPairId?: string) => {
    if (readPendingRunRequest()) throw new SignalApiError('pending', pendingMessage);
    // 応答を失った場合も、再読み込み後に同じ要求をGETで確認する。結果・認証情報は保存しない。
    try {
      localStorage.setItem(pendingRequestKey, JSON.stringify({ watchId, requestId }));
      const pending = readPendingRunRequest();
      if (pending?.watchId !== watchId || pending.requestId !== requestId) throw pendingStorageError();
    } catch { throw pendingStorageError(); }
    try {
      const run = decodeRun(await requestJson(`/watches/${encodeURIComponent(watchId)}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ intent, requestId, ...(comparisonPairId ? { comparisonPairId } : {}) }) }));
      if (run.watchId !== watchId) throw new ContractError();
      if (run.status !== 'running') clearPendingRunRequest(watchId, requestId);
      return run;
    } catch (failure) {
      if (failure instanceof SignalApiError && ['400', '401', '403', '404', '413', '422', '429'].includes(failure.code)) clearPendingRunRequest(watchId, requestId);
      throw failure;
    }
  },
};
export type SignalApi = typeof signalApi;

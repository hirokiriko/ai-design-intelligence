import { ContractError, decodeBootstrap, decodeRun, decodeRuns, decodeWatch, type WatchInput } from './contract';

export class SignalApiError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
export async function requestJson(path: string, options: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { ...options, credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', ...options.headers }, signal: options.signal ?? AbortSignal.timeout(195000) });
  } catch { throw new SignalApiError('connection', '通信が完了していません。保存履歴を再取得して実行状態を確認してください。'); }
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: '認証が必要です。管理者から案内された方法で認証し、再読み込みしてください。',
      403: '操作権限またはセッションを確認できません。再読み込みしてからやり直してください。',
      404: '保存結果または確認条件が見つかりません。',
      409: 'すでに実行中です。保存履歴から状態を再取得してください。',
      429: '実行回数または予算の上限に達しました。管理者に確認してください。',
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
  saveWatch: async (input: WatchInput, csrfToken: string) => decodeWatch(await requestJson('/watches', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(input) })),
  runs: async (watchId: string) => decodeRuns(await requestJson(`/runs?watchId=${encodeURIComponent(watchId)}`)),
  run: async (runId: string) => decodeRun(await requestJson(`/runs/${encodeURIComponent(runId)}`)),
  start: async (watchId: string, intent: 'check' | 'reanalyze', requestId: string, csrfToken: string) => decodeRun(await requestJson(`/watches/${encodeURIComponent(watchId)}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ intent, requestId }) })),
};
export type SignalApi = typeof signalApi;

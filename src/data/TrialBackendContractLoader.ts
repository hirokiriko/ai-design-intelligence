import {
  adaptBackendDesignExport,
  BackendContractDataSource,
  type BackendContractAdapterSuccess,
} from './BackendContractDataSource';
import { createBackendContractDemoRequest } from '../domain/presets';

export const TRIAL_BACKEND_CONTRACT_PATH = '/api/trial/design-export' as const;
export const TRIAL_BACKEND_CONTRACT_TIMEOUT_MS = 40_000;

export type TrialBackendContractErrorCode =
  | 'authentication_required'
  | 'expired'
  | 'data_unavailable'
  | 'unavailable'
  | 'invalid_contract';

export type TrialBackendContractLoadResult =
  | { ok: true; adapted: BackendContractAdapterSuccess }
  | { ok: false; code: TrialBackendContractErrorCode; message: string };

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const REQUEST_INIT: Readonly<RequestInit> = Object.freeze({
  method: 'GET',
  credentials: 'same-origin',
  mode: 'same-origin',
  cache: 'no-store',
  redirect: 'error',
  headers: Object.freeze({ Accept: 'application/json' }),
});

const ERROR_MESSAGES: Record<TrialBackendContractErrorCode, string> = {
  authentication_required: '認証または限定試用の利用権限を確認し、もう一度お試しください。',
  expired: '限定試用の利用期間が終了しています。',
  data_unavailable: '限定試用データがまだ配置されていません。',
  unavailable: '限定試用データを読み込めませんでした。時間をおいて再試行してください。',
  invalid_contract: '限定試用データを確認できませんでした。管理者にお問い合わせください。',
};

export async function loadTrialBackendContract(
  fetchImplementation: FetchImplementation = globalThis.fetch,
  timeoutMs = TRIAL_BACKEND_CONTRACT_TIMEOUT_MS,
): Promise<TrialBackendContractLoadResult> {
  const abortController = new AbortController();
  const timeout = globalThis.setTimeout(() => abortController.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetchImplementation(TRIAL_BACKEND_CONTRACT_PATH, {
        ...REQUEST_INIT,
        signal: abortController.signal,
      });
    } catch {
      return failure('unavailable');
    }

    if (!response.ok) {
      await discardResponseBody(response);
      return failure(errorCodeForStatus(response.status));
    }
    if (!isJsonContentType(response.headers.get('content-type'))) {
      await discardResponseBody(response);
      return failure('invalid_contract');
    }

    let value: unknown;
    try {
      value = await response.json() as unknown;
    } catch (error) {
      return abortController.signal.aborted || !(error instanceof SyntaxError)
        ? failure('unavailable')
        : failure('invalid_contract');
    }

    const adapted = adaptBackendDesignExport(value);
    if (!adapted.ok || adapted.summary.acceptedCount === 0) {
      return failure('invalid_contract');
    }

    try {
      const initialRecords = await new BackendContractDataSource(adapted).query(
        createBackendContractDemoRequest(),
      );
      if (initialRecords.length === 0) return failure('invalid_contract');
    } catch {
      return failure('invalid_contract');
    }

    return { ok: true, adapted };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Upstream error details are intentionally ignored.
  }
}

function errorCodeForStatus(status: number): TrialBackendContractErrorCode {
  if (status === 401 || status === 403) return 'authentication_required';
  if (status === 410) return 'expired';
  if (status === 404) return 'data_unavailable';
  if (status === 422) return 'invalid_contract';
  return 'unavailable';
}

function isJsonContentType(contentType: string | null): boolean {
  return contentType !== null && /^application\/json(?:\s*;|$)/i.test(contentType.trim());
}

function failure(
  code: TrialBackendContractErrorCode,
): Extract<TrialBackendContractLoadResult, { ok: false }> {
  return { ok: false, code, message: ERROR_MESSAGES[code] };
}

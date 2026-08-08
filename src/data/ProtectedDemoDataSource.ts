import {
  loadLocalJpoJson,
  type LocalJpoLoadFailure,
  type LocalJpoLoadSuccess,
} from './LocalJpoJsonDataSource';

const DEFAULT_ENDPOINT = '/api/demo-designs';
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const SOURCE_LABEL = '保護された同一オリジンデータ';

export async function loadProtectedDemoData(
  fetchImpl: typeof fetch = fetch,
  endpoint = DEFAULT_ENDPOINT,
): Promise<LocalJpoLoadSuccess | LocalJpoLoadFailure> {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//')) {
    return failure('保護データの取得先は同一オリジンの相対パスに限定されています。');
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      redirect: 'error',
    });
    if (!response.ok) {
      return failure(`保護データを取得できませんでした（HTTP ${response.status}）。環境設定を確認してください。`);
    }

    const declaredLength = Number(response.headers.get('content-length') ?? '0');
    if (declaredLength > MAX_RESPONSE_BYTES) return failure('保護データが許容サイズを超えています。');

    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      return failure('保護データが許容サイズを超えています。');
    }

    const parsed = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown;
    return loadLocalJpoJson(parsed, SOURCE_LABEL);
  } catch (error) {
    return failure(`保護データを読み込めませんでした: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
}

function failure(message: string): LocalJpoLoadFailure {
  return {
    ok: false,
    fileName: SOURCE_LABEL,
    errors: [message],
    warnings: [],
  };
}

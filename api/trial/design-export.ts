const FRONTEND_TRIAL_EXPORT_PATH = '/api/trial/design-export';
const BACKEND_TRIAL_EXPORT_PATH = '/v1/trial/design-export';
const BACKEND_TIMEOUT_MS = 10_000;

const RESPONSE_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
});

export interface TrialBackendProxyEnvironment {
  readonly KIRIKO_TRIAL_BACKEND_BASE_URL?: string;
  readonly KIRIKO_TRIAL_BACKEND_BEARER?: string;
  readonly KIRIKO_TRIAL_BACKEND_PROTECTION_BYPASS?: string;
}

export type TrialBackendFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface TrialBackendProxyConfig {
  readonly endpoint: string;
  readonly bearer: string;
  readonly protectionBypass?: string;
}

const handler = {
  async fetch(request: Request): Promise<Response> {
    return proxyTrialDesignExport(request, globalThis.fetch, process.env);
  },
};

export default handler;

export async function proxyTrialDesignExport(
  request: Request,
  fetchImplementation: TrialBackendFetch,
  environment: TrialBackendProxyEnvironment,
  timeoutMs = BACKEND_TIMEOUT_MS,
): Promise<Response> {
  const requestUrl = parseUrl(request.url);
  if (request.method !== 'GET') return errorResponse(405, 'method_not_allowed', { Allow: 'GET' });
  if (requestUrl === null || requestUrl.pathname !== FRONTEND_TRIAL_EXPORT_PATH) {
    return errorResponse(404, 'not_found');
  }
  if (requestUrl.search !== '') return errorResponse(400, 'invalid_request');

  const config = readProxyConfig(environment);
  if (config === null) return errorResponse(503, 'unavailable');

  const abortController = new AbortController();
  const abortUpstream = (): void => abortController.abort();
  if (request.signal.aborted) abortUpstream();
  else request.signal.addEventListener('abort', abortUpstream, { once: true });
  const timeout = globalThis.setTimeout(abortUpstream, timeoutMs);

  try {
    let upstreamResponse: Response;
    try {
      const upstreamHeaders: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${config.bearer}`,
      };
      if (config.protectionBypass !== undefined) {
        upstreamHeaders['x-vercel-protection-bypass'] = config.protectionBypass;
      }

      upstreamResponse = await fetchImplementation(config.endpoint, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'error',
        headers: upstreamHeaders,
        signal: abortController.signal,
      });
    } catch {
      return errorResponse(503, 'unavailable');
    }

    if (upstreamResponse.status !== 200) {
      await discardBody(upstreamResponse);
      const status = publicStatus(upstreamResponse.status);
      return errorResponse(status, publicErrorCode(status));
    }

    const contentType = upstreamResponse.headers.get('content-type');
    if (!isJsonContentType(contentType)) {
      await discardBody(upstreamResponse);
      return errorResponse(422, 'invalid_contract');
    }

    let responseBody: ArrayBuffer;
    try {
      responseBody = await upstreamResponse.arrayBuffer();
    } catch {
      return errorResponse(503, 'unavailable');
    }

    return new Response(responseBody, {
      status: 200,
      headers: {
        ...RESPONSE_HEADERS,
        'Content-Type': contentType,
      },
    });
  } finally {
    globalThis.clearTimeout(timeout);
    request.signal.removeEventListener('abort', abortUpstream);
  }
}

function readProxyConfig(
  environment: TrialBackendProxyEnvironment,
): TrialBackendProxyConfig | null {
  const rawBaseUrl = environment.KIRIKO_TRIAL_BACKEND_BASE_URL;
  const bearer = environment.KIRIKO_TRIAL_BACKEND_BEARER;
  const protectionBypass = environment.KIRIKO_TRIAL_BACKEND_PROTECTION_BYPASS;
  if (typeof rawBaseUrl !== 'string' || typeof bearer !== 'string') return null;
  if (rawBaseUrl !== rawBaseUrl.trim()) return null;
  if (!isValidServerSecret(bearer)) return null;
  if (protectionBypass !== undefined && !isValidServerSecret(protectionBypass)) return null;

  const baseUrl = parseUrl(rawBaseUrl);
  if (baseUrl === null || !isAllowedBackendOrigin(baseUrl)) return null;
  if (
    baseUrl.username !== '' ||
    baseUrl.password !== '' ||
    baseUrl.pathname !== '/' ||
    baseUrl.search !== '' ||
    baseUrl.hash !== ''
  ) {
    return null;
  }

  baseUrl.pathname = BACKEND_TRIAL_EXPORT_PATH;
  return {
    endpoint: baseUrl.toString(),
    bearer,
    ...(protectionBypass === undefined ? {} : { protectionBypass }),
  };
}

function isAllowedBackendOrigin(url: URL): boolean {
  if (url.protocol === 'https:') return true;
  if (url.protocol !== 'http:') return false;
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

function isValidServerSecret(value: string): boolean {
  const encodedLength = new TextEncoder().encode(value).byteLength;
  return (
    encodedLength >= 32 &&
    encodedLength <= 512 &&
    Array.from(value).every((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 0x21 && codePoint <= 0x7e;
    })
  );
}

function publicStatus(status: number): number {
  return [401, 403, 404, 410, 422, 503].includes(status) ? status : 503;
}

function publicErrorCode(status: number): string {
  if (status === 401 || status === 403) return 'authentication_required';
  if (status === 404) return 'data_unavailable';
  if (status === 410) return 'expired';
  if (status === 422) return 'invalid_contract';
  return 'unavailable';
}

function errorResponse(
  status: number,
  code: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error: { code } }), {
    status,
    headers: {
      ...RESPONSE_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isJsonContentType(contentType: string | null): contentType is string {
  return contentType !== null && /^application\/json(?:\s*;|$)/i.test(contentType.trim());
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Backend error details are intentionally ignored.
  }
}

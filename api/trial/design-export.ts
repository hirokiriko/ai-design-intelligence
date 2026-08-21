import { getVercelOidcToken } from '@vercel/functions/oidc';

const FRONTEND_TRIAL_EXPORT_PATH = '/api/trial/design-export';
const BACKEND_TRIAL_EXPORT_PATH = '/v1/trial/design-export';
const BACKEND_TIMEOUT_MS = 30_000;
const MAX_BACKEND_TIMEOUT_MS = 120_000;
const MAX_CONTRACT_BYTES = 25_000_000;
const MAX_TRUSTED_OIDC_TOKEN_BYTES = 16_384;
const STREAM_UNAVAILABLE_MESSAGE = 'Trial Contract stream unavailable.';

const RESPONSE_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
});

export interface TrialBackendProxyEnvironment {
  readonly KIRIKO_TRIAL_BACKEND_BASE_URL?: string;
  readonly KIRIKO_TRIAL_BACKEND_BEARER?: string;
}

export type TrialBackendFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type TrialBackendOidcTokenProvider = () => Promise<string>;

interface TrialBackendProxyConfig {
  readonly endpoint: string;
  readonly bearer: string;
}

const handler = {
  async fetch(request: Request): Promise<Response> {
    return proxyTrialDesignExport(
      request,
      globalThis.fetch,
      process.env,
      getVercelOidcToken,
    );
  },
};

export default handler;

export async function proxyTrialDesignExport(
  request: Request,
  fetchImplementation: TrialBackendFetch,
  environment: TrialBackendProxyEnvironment,
  oidcTokenProvider: TrialBackendOidcTokenProvider,
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
  if (!isValidTimeout(timeoutMs)) return errorResponse(503, 'unavailable');

  const abortController = new AbortController();
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;
  let cleanedUp = false;

  const cleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (timeout !== null) globalThis.clearTimeout(timeout);
    request.signal.removeEventListener('abort', abortUpstream);
  };
  const abortUpstream = (): void => {
    abortController.abort();
    if (upstreamReader !== null) void cancelBodyReader(upstreamReader);
    cleanup();
  };

  request.signal.addEventListener('abort', abortUpstream, { once: true });
  timeout = globalThis.setTimeout(abortUpstream, timeoutMs);
  if (request.signal.aborted) abortUpstream();

  let trustedOidcToken: string;
  try {
    trustedOidcToken = await resolveOidcToken(oidcTokenProvider, abortController.signal);
  } catch {
    abortUpstream();
    return errorResponse(503, 'unavailable');
  }
  if (!isValidTrustedOidcToken(trustedOidcToken)) {
    cleanup();
    return errorResponse(503, 'unavailable');
  }

  let upstreamResponse: Response;
  try {
    const upstreamHeaders: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'identity',
      Authorization: `Bearer ${config.bearer}`,
      'x-vercel-trusted-oidc-idp-token': trustedOidcToken,
    };

    upstreamResponse = await fetchImplementation(config.endpoint, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      headers: upstreamHeaders,
      signal: abortController.signal,
    });
  } catch {
    cleanup();
    return errorResponse(503, 'unavailable');
  }

  if (upstreamResponse.status !== 200) {
    await discardBody(upstreamResponse);
    cleanup();
    const status = publicStatus(upstreamResponse.status);
    return errorResponse(status, publicErrorCode(status));
  }

  const contentType = upstreamResponse.headers.get('content-type');
  if (!isJsonContentType(contentType)) {
    await discardBody(upstreamResponse);
    cleanup();
    return errorResponse(422, 'invalid_contract');
  }

  const contentLength = parseContentLength(upstreamResponse.headers.get('content-length'));
  if (!contentLength.valid || upstreamResponse.body === null) {
    await discardBody(upstreamResponse);
    cleanup();
    return errorResponse(422, 'invalid_contract');
  }

  upstreamReader = upstreamResponse.body.getReader();
  let firstChunk: Uint8Array | null;
  try {
    firstChunk = await readFirstNonEmptyChunk(upstreamReader);
  } catch {
    abortUpstream();
    return errorResponse(503, 'unavailable');
  }
  if (abortController.signal.aborted) {
    abortUpstream();
    return errorResponse(503, 'unavailable');
  }
  if (firstChunk === null) {
    await cancelBodyReader(upstreamReader);
    cleanup();
    return errorResponse(422, 'invalid_contract');
  }
  if (
    firstChunk.byteLength > MAX_CONTRACT_BYTES ||
    (contentLength.value !== null && firstChunk.byteLength > contentLength.value)
  ) {
    await cancelBodyReader(upstreamReader);
    cleanup();
    return errorResponse(422, 'invalid_contract');
  }

  const responseHeaders: Record<string, string> = {
    ...RESPONSE_HEADERS,
    'Content-Type': contentType,
  };
  // Vercel owns the downstream Content-Length for streamed responses. The
  // upstream value remains an internal byte-integrity gate for this relay.

  return new Response(
    createRelayStream(
      upstreamReader,
      firstChunk,
      contentLength.value,
      abortController,
      cleanup,
    ),
    {
      status: 200,
      headers: responseHeaders,
    },
  );
}

function readProxyConfig(
  environment: TrialBackendProxyEnvironment,
): TrialBackendProxyConfig | null {
  const rawBaseUrl = environment.KIRIKO_TRIAL_BACKEND_BASE_URL;
  const bearer = environment.KIRIKO_TRIAL_BACKEND_BEARER;
  if (typeof rawBaseUrl !== 'string' || typeof bearer !== 'string') return null;
  if (rawBaseUrl !== rawBaseUrl.trim()) return null;
  if (!isValidServerSecret(bearer)) return null;

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
  return { endpoint: baseUrl.toString(), bearer };
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

function isValidTrustedOidcToken(value: string): boolean {
  const encodedLength = new TextEncoder().encode(value).byteLength;
  return (
    encodedLength >= 64 &&
    encodedLength <= MAX_TRUSTED_OIDC_TOKEN_BYTES &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  );
}

function isValidTimeout(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_BACKEND_TIMEOUT_MS;
}

async function resolveOidcToken(
  provider: TrialBackendOidcTokenProvider,
  signal: AbortSignal,
): Promise<string> {
  if (signal.aborted) throw new DOMException('Operation aborted.', 'AbortError');
  let rejectForAbort: (() => void) | null = null;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectForAbort = () => reject(new DOMException('Operation aborted.', 'AbortError'));
    signal.addEventListener('abort', rejectForAbort, { once: true });
  });
  try {
    return await Promise.race([provider(), aborted]);
  } finally {
    if (rejectForAbort !== null) signal.removeEventListener('abort', rejectForAbort);
  }
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

type ParsedContentLength =
  | { readonly valid: true; readonly value: number | null }
  | { readonly valid: false; readonly value: null };

function parseContentLength(value: string | null): ParsedContentLength {
  if (value === null) return { valid: true, value: null };
  if (!/^[1-9][0-9]*$/.test(value)) return { valid: false, value: null };
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_CONTRACT_BYTES) {
    return { valid: false, value: null };
  }
  return { valid: true, value: parsed };
}

async function readFirstNonEmptyChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<Uint8Array | null> {
  while (true) {
    const result = await reader.read();
    if (result.done) return null;
    if (result.value.byteLength > 0) return result.value;
  }
}

function createRelayStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  initialChunk: Uint8Array,
  declaredLength: number | null,
  abortController: AbortController,
  cleanup: () => void,
): ReadableStream<Uint8Array> {
  let pendingChunk: Uint8Array | null = initialChunk;
  let transferredBytes = 0;
  let settled = false;

  const terminate = async (): Promise<void> => {
    if (settled) return;
    settled = true;
    abortController.abort();
    await cancelBodyReader(reader);
    cleanup();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (settled) return;
      try {
        if (abortController.signal.aborted) {
          await terminate();
          controller.error(new TypeError(STREAM_UNAVAILABLE_MESSAGE));
          return;
        }
        let chunk: Uint8Array;
        if (pendingChunk !== null) {
          chunk = pendingChunk;
          pendingChunk = null;
        } else {
          const result = await reader.read();
          if (result.done) {
            if (
              abortController.signal.aborted ||
              (declaredLength !== null && transferredBytes !== declaredLength)
            ) {
              await terminate();
              controller.error(new TypeError(STREAM_UNAVAILABLE_MESSAGE));
              return;
            }
            settled = true;
            releaseBodyReader(reader);
            cleanup();
            controller.close();
            return;
          }
          chunk = result.value;
          if (chunk.byteLength === 0) return;
        }

        const nextTotal = transferredBytes + chunk.byteLength;
        if (
          nextTotal > MAX_CONTRACT_BYTES ||
          (declaredLength !== null && nextTotal > declaredLength)
        ) {
          await terminate();
          controller.error(new TypeError(STREAM_UNAVAILABLE_MESSAGE));
          return;
        }
        transferredBytes = nextTotal;
        controller.enqueue(chunk);
      } catch {
        await terminate();
        controller.error(new TypeError(STREAM_UNAVAILABLE_MESSAGE));
      }
    },
    async cancel() {
      await terminate();
    },
  });
}

async function cancelBodyReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // No provider or body details cross the proxy boundary.
  }
  releaseBodyReader(reader);
}

function releaseBodyReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  try {
    reader.releaseLock();
  } catch {
    // A pending read owns the lock until its abort settles.
  }
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Backend error details are intentionally ignored.
  }
}

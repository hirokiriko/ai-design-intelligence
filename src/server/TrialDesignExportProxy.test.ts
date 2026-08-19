import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import trialDesignExportHandler, {
  proxyTrialDesignExport,
  type TrialBackendFetch,
  type TrialBackendOidcTokenProvider,
  type TrialBackendProxyEnvironment,
} from '../../api/trial/design-export';
import fictionalExport from '../../fixtures/backend-contract-v0.1.0/design-export-fictional.json';
import { adaptBackendDesignExport } from '../data/BackendContractDataSource';

const FRONTEND_URL = 'https://frontend.example.test/api/trial/design-export';
const BACKEND_BASE_URL = 'https://backend.example.test';
const BACKEND_ENDPOINT = `${BACKEND_BASE_URL}/v1/trial/design-export`;
const TEST_BEARER = 'FIXTURE-SERVER-ONLY-BEARER-000001';
const TEST_OIDC_TOKEN =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL29pZGMudmVyY2VsLmNvbSIsInN1YiI6IkZJWFRVUkUifQ.RklYVFVSRS1TSUdOQVRVUkUtMDAwMDAx';
const OIDC_TOKEN_PROVIDER: TrialBackendOidcTokenProvider = async () => TEST_OIDC_TOKEN;
const ENVIRONMENT: TrialBackendProxyEnvironment = {
  KIRIKO_TRIAL_BACKEND_BASE_URL: BACKEND_BASE_URL,
  KIRIKO_TRIAL_BACKEND_BEARER: TEST_BEARER,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('trial design export server-side proxy', () => {
  it('opts the exact Vercel route into request cancellation for stream cleanup', () => {
    const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8')) as {
      functions?: Record<string, { maxDuration?: unknown; supportsCancellation?: unknown }>;
    };

    expect(config.functions?.['api/trial/design-export.ts']).toEqual({
      maxDuration: 35,
      supportsCancellation: true,
    });
  });

  it('reads Backend configuration only inside the default server handler', async () => {
    vi.stubEnv('KIRIKO_TRIAL_BACKEND_BASE_URL', BACKEND_BASE_URL);
    vi.stubEnv('KIRIKO_TRIAL_BACKEND_BEARER', TEST_BEARER);
    vi.stubEnv('VERCEL_OIDC_TOKEN', TEST_OIDC_TOKEN);
    const fetchMock = vi.fn(async () =>
      new Response('{"contractVersion":"0.1.0"}', {
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await trialDesignExportHandler.fetch(new Request(FRONTEND_URL));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"contractVersion":"0.1.0"}');
    expect(fetchMock).toHaveBeenCalledWith(
      BACKEND_ENDPOINT,
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'identity',
          Authorization: `Bearer ${TEST_BEARER}`,
          'x-vercel-trusted-oidc-idp-token': TEST_OIDC_TOKEN,
        },
      }),
    );
  });

  it('fails closed in the default server handler when server-only env is missing', async () => {
    vi.stubEnv('KIRIKO_TRIAL_BACKEND_BASE_URL', '');
    vi.stubEnv('KIRIKO_TRIAL_BACKEND_BEARER', '');
    const fetchMock = vi.fn<TrialBackendFetch>();
    vi.stubGlobal('fetch', fetchMock);

    const response = await trialDesignExportHandler.fetch(new Request(FRONTEND_URL));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":{"code":"unavailable"}}');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds only server credentials to the fixed Backend endpoint', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('{"contractVersion":"0.1.0"}', {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );
    const request = new Request(FRONTEND_URL, {
      headers: {
        Authorization: 'Basic FIXTURE-BROWSER-CREDENTIAL',
        Cookie: 'session=FIXTURE-BROWSER-COOKIE',
        Origin: 'https://frontend.example.test',
        'x-vercel-oidc-token': 'FIXTURE-BROWSER-SOURCE-OIDC-TOKEN',
        'x-vercel-trusted-oidc-idp-token': 'FIXTURE-BROWSER-OIDC-TOKEN',
      },
    });

    const response = await proxyTrialDesignExport(
      request,
      fetchMock,
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(BACKEND_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'identity',
        Authorization: `Bearer ${TEST_BEARER}`,
        'x-vercel-trusted-oidc-idp-token': TEST_OIDC_TOKEN,
      },
      signal: expect.any(AbortSignal),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');
    expect(await response.text()).toBe('{"contractVersion":"0.1.0"}');
  });

  it('uses the provider OIDC token and ignores a browser-provided value', async () => {
    const fetchMock = vi.fn<TrialBackendFetch>(async () =>
      new Response('{"contractVersion":"0.1.0"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const request = new Request(FRONTEND_URL, {
      headers: {
        'x-vercel-trusted-oidc-idp-token': 'FIXTURE-BROWSER-OIDC-TOKEN',
      },
    });

    const response = await proxyTrialDesignExport(
      request,
      fetchMock,
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );

    expect(fetchMock).toHaveBeenCalledWith(BACKEND_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'identity',
        Authorization: `Bearer ${TEST_BEARER}`,
        'x-vercel-trusted-oidc-idp-token': TEST_OIDC_TOKEN,
      },
      signal: expect.any(AbortSignal),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain(TEST_OIDC_TOKEN);
    const forwardedHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(forwardedHeaders.get('x-vercel-trusted-oidc-idp-token')).toBe(TEST_OIDC_TOKEN);
    expect(forwardedHeaders.get('x-vercel-trusted-oidc-idp-token')).not.toBe(
      'FIXTURE-BROWSER-OIDC-TOKEN',
    );
  });

  it.each([
    ['POST', FRONTEND_URL, 405],
    ['GET', 'https://frontend.example.test/api/trial/other', 404],
    ['GET', `${FRONTEND_URL}?target=https://backend.invalid`, 400],
  ] as const)('rejects %s %s without contacting Backend', async (method, url, status) => {
    const fetchMock = vi.fn<TrialBackendFetch>();

    const response = await proxyTrialDesignExport(
      new Request(url, { method }),
      fetchMock,
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );

    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { KIRIKO_TRIAL_BACKEND_BEARER: TEST_BEARER },
    { KIRIKO_TRIAL_BACKEND_BASE_URL: BACKEND_BASE_URL },
    {
      KIRIKO_TRIAL_BACKEND_BASE_URL: 'https://backend.example.test/untrusted-path',
      KIRIKO_TRIAL_BACKEND_BEARER: TEST_BEARER,
    },
    {
      KIRIKO_TRIAL_BACKEND_BASE_URL: 'http://backend.example.test',
      KIRIKO_TRIAL_BACKEND_BEARER: TEST_BEARER,
    },
    {
      KIRIKO_TRIAL_BACKEND_BASE_URL: BACKEND_BASE_URL,
      KIRIKO_TRIAL_BACKEND_BEARER: 'too-short',
    },
  ] as const)('fails closed for invalid configuration %#', async (environment) => {
    const fetchMock = vi.fn<TrialBackendFetch>();

    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      fetchMock,
      environment,
      OIDC_TOKEN_PROVIDER,
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":{"code":"unavailable"}}');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'missing', provider: async () => '' },
    {
      name: 'throwing',
      provider: async () => {
        throw new Error(`FIXTURE-OIDC-PROVIDER-ERROR-${TEST_OIDC_TOKEN}`);
      },
    },
    { name: 'malformed', provider: async () => 'FIXTURE-NOT-A-JWT' },
    {
      name: 'oversized',
      provider: async () => `a.${'b'.repeat(16_384)}.c`,
    },
  ] satisfies ReadonlyArray<{ name: string; provider: TrialBackendOidcTokenProvider }>)(
    'fails closed for a $name OIDC token before contacting Backend',
    async ({ provider }) => {
      const fetchMock = vi.fn<TrialBackendFetch>();

      const response = await proxyTrialDesignExport(
        new Request(FRONTEND_URL),
        fetchMock,
        ENVIRONMENT,
        provider,
      );

      expect(response.status).toBe(503);
      expect(await response.text()).toBe('{"error":{"code":"unavailable"}}');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    [401, 'authentication_required'],
    [403, 'authentication_required'],
    [404, 'data_unavailable'],
    [410, 'expired'],
    [422, 'invalid_contract'],
    [503, 'unavailable'],
  ] as const)('preserves Backend %i with only the safe %s classification', async (status, code) => {
    const confidentialBody = `FIXTURE-CONFIDENTIAL-${status}-${TEST_BEARER}-${TEST_OIDC_TOKEN}`;
    const fetchMock = vi.fn(async () =>
      new Response(confidentialBody, {
        status,
        headers: {
          Location: 'https://internal-backend.example.test/private',
          'WWW-Authenticate': 'Bearer realm="private-backend"',
        },
      }),
    );

    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      fetchMock,
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );
    const body = await response.text();

    expect(response.status).toBe(status);
    expect(body).toBe(JSON.stringify({ error: { code } }));
    expect(body).not.toContain(confidentialBody);
    expect(body).not.toContain(TEST_BEARER);
    expect(body).not.toContain(TEST_OIDC_TOKEN);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('rejects an upstream redirect without exposing its target', async () => {
    const redirectTarget = 'https://internal-backend.example.test/private';
    const fetchMock = vi.fn(async () =>
      new Response(null, { status: 302, headers: { Location: redirectTarget } }),
    );

    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      fetchMock,
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain(redirectTarget);
    expect(response.headers.get('location')).toBeNull();
  });

  it('aborts a stalled Backend request before the browser timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException(`FIXTURE-TIMEOUT-${TEST_BEARER}`, 'AbortError'));
          });
        }),
    );

    const responsePromise = proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      fetchMock,
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
      25,
    );
    await vi.advanceTimersByTimeAsync(25);
    const response = await responsePromise;
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain(TEST_BEARER);
    expect(body).not.toContain(TEST_OIDC_TOKEN);
  });

  it('keeps the timeout active while reading the Backend response body', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            init?.signal?.addEventListener('abort', () => {
              controller.error(
                new DOMException(`FIXTURE-BODY-TIMEOUT-${TEST_BEARER}`, 'AbortError'),
              );
            });
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );

    const responsePromise = proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      fetchMock,
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
      25,
    );
    await vi.advanceTimersByTimeAsync(25);
    const response = await responsePromise;
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain(TEST_BEARER);
    expect(body).not.toContain(TEST_OIDC_TOKEN);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('relays a fully fictional Contract larger than 4 MB without upstream body buffering', async () => {
    vi.useFakeTimers();
    const rawDocument = buildLargeFictionalContract();
    const rawBytes = new TextEncoder().encode(rawDocument);
    expect(rawBytes.byteLength).toBeGreaterThan(4_000_000);
    const upstreamResponse = chunkedJsonResponse(rawBytes, 64 * 1024);
    const arrayBufferSpy = vi.spyOn(upstreamResponse, 'arrayBuffer');
    const textSpy = vi.spyOn(upstreamResponse, 'text');
    const jsonSpy = vi.spyOn(upstreamResponse, 'json');
    let upstreamSignal: AbortSignal | null = null;
    const fetchMock = vi.fn<TrialBackendFetch>(async (_input, init) => {
      upstreamSignal = init?.signal ?? null;
      return upstreamResponse;
    });
    const downstreamAbort = new AbortController();
    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL, { signal: downstreamAbort.signal }),
      fetchMock,
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const chunks = await readChunks(requireBody(response));
    expect(chunks.length).toBeGreaterThan(1);
    const reconstructed = concatenateChunks(chunks);
    expect(bytesAreEqual(reconstructed, rawBytes)).toBe(true);
    expect(arrayBufferSpy).not.toHaveBeenCalled();
    expect(textSpy).not.toHaveBeenCalled();
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(adaptBackendDesignExport(JSON.parse(new TextDecoder().decode(reconstructed))).ok).toBe(
      true,
    );
    expect(vi.getTimerCount()).toBe(0);
    expect(isAborted(upstreamSignal)).toBe(false);
    downstreamAbort.abort();
    expect(isAborted(upstreamSignal)).toBe(false);
  }, 15_000);

  it('keeps timeout active after response creation and fails a stalled mid-stream body', async () => {
    vi.useFakeTimers();
    const sourceCancelled = vi.fn();
    let upstreamSignal: AbortSignal | null = null;
    const fetchMock = vi.fn<TrialBackendFetch>(async (_input, init) => {
      upstreamSignal = init?.signal ?? null;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{'));
          },
          cancel: sourceCancelled,
        }),
        {
          headers: {
            'content-type': 'application/json',
            'content-length': '2',
          },
        },
      );
    });
    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      fetchMock,
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
      25,
    );

    expect(response.status).toBe(200);
    const bodyPromise = response.text();
    const bodyRejection = expect(bodyPromise).rejects.toThrow(
      'Trial Contract stream unavailable.',
    );
    await vi.advanceTimersByTimeAsync(25);

    await bodyRejection;
    expect(isAborted(upstreamSignal)).toBe(true);
    expect(sourceCancelled).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates downstream body cancellation and request disconnect to upstream cleanup', async () => {
    vi.useFakeTimers();
    const makeUpstream = () => {
      const cancelled = vi.fn();
      const response = new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{'));
          },
          cancel: cancelled,
        }),
        { headers: { 'content-type': 'application/json' } },
      );
      return { cancelled, response };
    };

    const first = makeUpstream();
    let firstSignal: AbortSignal | null = null;
    const firstResponse = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      vi.fn<TrialBackendFetch>(async (_input, init) => {
        firstSignal = init?.signal ?? null;
        return first.response;
      }),
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );
    const downstreamReader = requireBody(firstResponse).getReader();
    await downstreamReader.read();
    await downstreamReader.cancel();
    expect(isAborted(firstSignal)).toBe(true);
    expect(first.cancelled).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);

    const second = makeUpstream();
    const requestAbort = new AbortController();
    let secondSignal: AbortSignal | null = null;
    const secondResponse = await proxyTrialDesignExport(
      new Request(FRONTEND_URL, { signal: requestAbort.signal }),
      vi.fn<TrialBackendFetch>(async (_input, init) => {
        secondSignal = init?.signal ?? null;
        return second.response;
      }),
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );
    requestAbort.abort();
    await expect(secondResponse.text()).rejects.toThrow('Trial Contract stream unavailable.');
    expect(isAborted(secondSignal)).toBe(true);
    expect(second.cancelled).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['0', '-1', '25000001', '1.5', ' 10', '10 '])(
    'rejects unsafe upstream Content-Length %s before returning Contract bytes',
    async (contentLength) => {
      const fetchMock = vi.fn(async () =>
        new Response('{"fixture":true}', {
          headers: {
            'content-type': 'application/json',
            'content-length': contentLength,
          },
        }),
      );

      const response = await proxyTrialDesignExport(
        new Request(FRONTEND_URL),
        fetchMock,
        ENVIRONMENT,
        OIDC_TOKEN_PROVIDER,
      );

      expect(response.status).toBe(422);
      expect(await response.text()).toBe('{"error":{"code":"invalid_contract"}}');
    },
  );

  it.each([
    ['null body', () => new Response(null, { headers: { 'content-type': 'application/json' } })],
    [
      'empty stream',
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.close();
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    ],
  ] as const)('rejects a 200 response with %s before Browser delivery', async (_label, factory) => {
    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      vi.fn(async () => factory()),
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );

    expect(response.status).toBe(422);
    expect(await response.text()).toBe('{"error":{"code":"invalid_contract"}}');
  });

  it('errors the Browser stream when declared and actual byte lengths differ', async () => {
    vi.useFakeTimers();
    let upstreamSignal: AbortSignal | null = null;
    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      vi.fn(async (_input, init) => {
        upstreamSignal = init?.signal ?? null;
        return new Response('{"fixture":true}', {
          headers: {
            'content-type': 'application/json',
            'content-length': '17',
          },
        });
      }),
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );

    expect(response.status).toBe(200);
    await expect(response.text()).rejects.toThrow('Trial Contract stream unavailable.');
    expect(isAborted(upstreamSignal)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('enforces the actual streamed byte cap even without Content-Length', async () => {
    vi.useFakeTimers();
    const chunk = new Uint8Array(1_000_000);
    let emitted = 0;
    const sourceCancelled = vi.fn();
    const upstreamResponse = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (emitted === 26) {
            return;
          }
          emitted += 1;
          controller.enqueue(chunk);
        },
        cancel: sourceCancelled,
      }),
      { headers: { 'content-type': 'application/json' } },
    );
    let upstreamSignal: AbortSignal | null = null;
    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      vi.fn(async (_input, init) => {
        upstreamSignal = init?.signal ?? null;
        return upstreamResponse;
      }),
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );

    expect(response.status).toBe(200);
    await expect(drainBody(requireBody(response))).rejects.toThrow(
      'Trial Contract stream unavailable.',
    );
    expect(isAborted(upstreamSignal)).toBe(true);
    expect(sourceCancelled).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a stalled OIDC provider before contacting Backend', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<TrialBackendFetch>();
    const oidcProvider = vi.fn<TrialBackendOidcTokenProvider>(
      () => new Promise<string>(() => undefined),
    );

    const responsePromise = proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      fetchMock,
      ENVIRONMENT,
      oidcProvider,
      25,
    );
    await vi.advanceTimersByTimeAsync(25);
    const response = await responsePromise;

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":{"code":"unavailable"}}');
    expect(oidcProvider).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects invalid timeout policy before requesting OIDC or Backend', async () => {
    const fetchMock = vi.fn<TrialBackendFetch>();
    const oidcProvider = vi.fn<TrialBackendOidcTokenProvider>();

    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      fetchMock,
      ENVIRONMENT,
      oidcProvider,
      0,
    );

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(oidcProvider).not.toHaveBeenCalled();
  });

  it('does not log Backend URL, credential, error, or response body', async () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
    const fetchMock = vi.fn(async () => {
      throw new Error(
        `${BACKEND_ENDPOINT} ${TEST_BEARER} ${TEST_OIDC_TOKEN} FIXTURE-PRIVATE-BODY`,
      );
    });

    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      fetchMock,
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );
    const body = await response.text();

    spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    expect(body).not.toContain(BACKEND_BASE_URL);
    expect(body).not.toContain(TEST_BEARER);
    expect(body).not.toContain(TEST_OIDC_TOKEN);
    expect(body).not.toContain('FIXTURE-PRIVATE-BODY');
  });

  it('rejects a non-JSON success body as an invalid contract', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('FIXTURE-PRIVATE-HTML', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );

    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      fetchMock,
      ENVIRONMENT,
      OIDC_TOKEN_PROVIDER,
    );

    expect(response.status).toBe(422);
    expect(await response.text()).toBe('{"error":{"code":"invalid_contract"}}');
  });
});

function buildLargeFictionalContract(): string {
  const document = structuredClone(fictionalExport) as unknown as {
    records: Array<Record<string, unknown>>;
  };
  const target = document.records[document.records.length - 1];
  if (target === undefined) throw new Error('Fictional Contract requires a padding record.');
  target.description = 'FIXTURE-LARGE-PADDING-'.repeat(200_000);
  const rawDocument = JSON.stringify(document);
  if (new TextEncoder().encode(rawDocument).byteLength <= 4_000_000) {
    throw new Error('Fictional Contract did not reach the large-payload boundary.');
  }
  return rawDocument;
}

function chunkedJsonResponse(bytes: Uint8Array, chunkSize: number): Response {
  let offset = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.byteLength) {
          controller.close();
          return;
        }
        const nextOffset = Math.min(offset + chunkSize, bytes.byteLength);
        controller.enqueue(bytes.slice(offset, nextOffset));
        offset = nextOffset;
      },
    }),
    {
      headers: {
        'content-type': 'application/json',
        'content-length': String(bytes.byteLength),
      },
    },
  );
}

function requireBody(response: Response): ReadableStream<Uint8Array> {
  if (response.body === null) throw new Error('Expected a fictional response body.');
  return response.body;
}

async function readChunks(body: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const result = await reader.read();
    if (result.done) return chunks;
    chunks.push(result.value);
  }
}

function concatenateChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function bytesAreEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function drainBody(body: ReadableStream<Uint8Array>): Promise<void> {
  const reader = body.getReader();
  while (!(await reader.read()).done) {
    // Deliberately discard fictional bytes while exercising the stream cap.
  }
}

function isAborted(signal: AbortSignal | null): boolean {
  return signal?.aborted === true;
}

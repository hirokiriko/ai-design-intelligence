import { afterEach, describe, expect, it, vi } from 'vitest';
import trialDesignExportHandler, {
  proxyTrialDesignExport,
  type TrialBackendFetch,
  type TrialBackendProxyEnvironment,
} from '../../api/trial/design-export';

const FRONTEND_URL = 'https://frontend.example.test/api/trial/design-export';
const BACKEND_BASE_URL = 'https://backend.example.test';
const BACKEND_ENDPOINT = `${BACKEND_BASE_URL}/v1/trial/design-export`;
const TEST_BEARER = 'FIXTURE-SERVER-ONLY-BEARER-000001';
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
  it('reads Backend configuration only inside the default server handler', async () => {
    vi.stubEnv('KIRIKO_TRIAL_BACKEND_BASE_URL', BACKEND_BASE_URL);
    vi.stubEnv('KIRIKO_TRIAL_BACKEND_BEARER', TEST_BEARER);
    const fetchMock = vi.fn(async () =>
      new Response('{"contractVersion":"0.1.0"}', {
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await trialDesignExportHandler.fetch(new Request(FRONTEND_URL));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      BACKEND_ENDPOINT,
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${TEST_BEARER}`,
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

  it('adds only the server-side Bearer to the fixed Backend endpoint', async () => {
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
      },
    });

    const response = await proxyTrialDesignExport(request, fetchMock, ENVIRONMENT);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(BACKEND_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${TEST_BEARER}`,
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
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":{"code":"unavailable"}}');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'authentication_required'],
    [403, 'authentication_required'],
    [404, 'data_unavailable'],
    [410, 'expired'],
    [422, 'invalid_contract'],
    [503, 'unavailable'],
  ] as const)('preserves Backend %i with only the safe %s classification', async (status, code) => {
    const confidentialBody = `FIXTURE-CONFIDENTIAL-${status}-${TEST_BEARER}`;
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
    );
    const body = await response.text();

    expect(response.status).toBe(status);
    expect(body).toBe(JSON.stringify({ error: { code } }));
    expect(body).not.toContain(confidentialBody);
    expect(body).not.toContain(TEST_BEARER);
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
      25,
    );
    await vi.advanceTimersByTimeAsync(25);
    const response = await responsePromise;
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain(TEST_BEARER);
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
      25,
    );
    await vi.advanceTimersByTimeAsync(25);
    const response = await responsePromise;
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain(TEST_BEARER);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('does not log Backend URL, credential, error, or response body', async () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
    const fetchMock = vi.fn(async () => {
      throw new Error(`${BACKEND_ENDPOINT} ${TEST_BEARER} FIXTURE-PRIVATE-BODY`);
    });

    const response = await proxyTrialDesignExport(
      new Request(FRONTEND_URL),
      fetchMock,
      ENVIRONMENT,
    );
    const body = await response.text();

    spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    expect(body).not.toContain(BACKEND_BASE_URL);
    expect(body).not.toContain(TEST_BEARER);
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
    );

    expect(response.status).toBe(422);
    expect(await response.text()).toBe('{"error":{"code":"invalid_contract"}}');
  });
});

import fictionalExport from '../../fixtures/backend-contract-v0.1.0/design-export-fictional.json';
import { describe, expect, it, vi } from 'vitest';
import {
  loadTrialBackendContract,
  TRIAL_BACKEND_CONTRACT_PATH,
  type TrialBackendContractErrorCode,
} from './TrialBackendContractLoader';

describe('trial Backend Contract loader', () => {
  it('uses the fixed same-origin request and adapts a fully fictional contract directly', async () => {
    const fetchMock = vi.fn(
      async () => jsonResponse(fictionalExport),
    );

    const result = await loadTrialBackendContract(fetchMock);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(TRIAL_BACKEND_CONTRACT_PATH, {
      method: 'GET',
      credentials: 'same-origin',
      mode: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { Accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.adapted.meta.exportId).toBe('FIXTURE-FRONTEND-V010');
    expect(result.adapted.summary.acceptedCount).toBeGreaterThan(0);
  });

  it.each([
    [401, 'authentication_required'],
    [410, 'expired'],
    [404, 'data_unavailable'],
    [403, 'authentication_required'],
    [422, 'invalid_contract'],
    [503, 'unavailable'],
    [408, 'unavailable'],
    [429, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('maps HTTP %i to the public-safe %s error without reading its body', async (status, code) => {
    const json = vi.fn(async () => ({ confidential: 'FIXTURE-DO-NOT-EXPOSE' }));
    const response = {
      ok: false,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json,
    } as unknown as Response;

    const result = await loadTrialBackendContract(vi.fn(async () => response));

    expectFailure(result, code);
    expect(json).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('FIXTURE-DO-NOT-EXPOSE');
    expect(JSON.stringify(result)).not.toContain(TRIAL_BACKEND_CONTRACT_PATH);
  });

  it('normalizes network and redirect failures without exposing their details', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('FIXTURE-CONFIDENTIAL-NETWORK-DETAIL');
    });

    const result = await loadTrialBackendContract(fetchMock);

    expectFailure(result, 'unavailable');
    expect(JSON.stringify(result)).not.toContain('FIXTURE-CONFIDENTIAL-NETWORK-DETAIL');
  });

  it('aborts a stalled request and reports a public-safe unavailable state', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(
        async (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('FIXTURE-CONFIDENTIAL-TIMEOUT-DETAIL', 'AbortError'));
            });
          }),
      );

      const resultPromise = loadTrialBackendContract(fetchMock, 25);
      await vi.advanceTimersByTimeAsync(25);
      const result = await resultPromise;

      expectFailure(result, 'unavailable');
      expect(JSON.stringify(result)).not.toContain('FIXTURE-CONFIDENTIAL-TIMEOUT-DETAIL');
    } finally {
      vi.useRealTimers();
    }
  });

  it('maps a mid-stream read failure to unavailable without exposing details', async () => {
    const confidentialDetail = 'FIXTURE-CONFIDENTIAL-STREAM-DETAIL';
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{'));
          controller.error(new TypeError(confidentialDetail));
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    );

    const result = await loadTrialBackendContract(vi.fn(async () => response));

    expectFailure(result, 'unavailable');
    expect(JSON.stringify(result)).not.toContain(confidentialDetail);
  });

  it('keeps the Browser timeout active until response stream completion', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(
        async (_input: RequestInfo | URL, init?: RequestInit) =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('{'));
                init?.signal?.addEventListener('abort', () => {
                  controller.error(
                    new DOMException('FIXTURE-CONFIDENTIAL-BODY-TIMEOUT', 'AbortError'),
                  );
                });
              },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
      );

      const resultPromise = loadTrialBackendContract(fetchMock, 25);
      await vi.advanceTimersByTimeAsync(25);
      const result = await resultPromise;

      expectFailure(result, 'unavailable');
      expect(JSON.stringify(result)).not.toContain('FIXTURE-CONFIDENTIAL-BODY-TIMEOUT');
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ['non-JSON content', () => new Response('FIXTURE-HTML', { headers: { 'content-type': 'text/html' } })],
    ['malformed JSON', () => new Response('{', { headers: { 'content-type': 'application/json' } })],
    ['unsupported contract', () => jsonResponse(contractWithVersion('9.9.9'))],
    ['unsafe contract', () => jsonResponse(contractWithUnsafeLocator())],
    ['zero accepted records', () => jsonResponse(emptyContract())],
    ['zero initial records', () => jsonResponse(contractWithOnlyOutdatedAcceptedRecords())],
  ] as const)('rejects %s as an invalid contract', async (_label, responseFactory) => {
    const result = await loadTrialBackendContract(vi.fn(async () => responseFactory()));

    expectFailure(result, 'invalid_contract');
  });

  it('performs a fresh request every time the caller reloads', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(fictionalExport));

    const first = await loadTrialBackendContract(fetchMock);
    const second = await loadTrialBackendContract(fetchMock);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cloneFictionalExport(): Record<string, unknown> {
  return structuredClone(fictionalExport) as Record<string, unknown>;
}

function contractWithVersion(contractVersion: string): Record<string, unknown> {
  return { ...cloneFictionalExport(), contractVersion };
}

function contractWithUnsafeLocator(): Record<string, unknown> {
  const contract = cloneFictionalExport();
  const records = contract.records as Array<Record<string, unknown>>;
  const provenance = records[0].provenance as Record<string, unknown>;
  provenance.sourceRecordLocator = 'https://fixture.invalid/private-record';
  return contract;
}

function emptyContract(): Record<string, unknown> {
  return { ...cloneFictionalExport(), recordCount: 0, records: [] };
}

function contractWithOnlyOutdatedAcceptedRecords(): Record<string, unknown> {
  const contract = cloneFictionalExport();
  const records = contract.records as Array<Record<string, unknown>>;
  for (const record of records) {
    if (typeof record.gazetteDate === 'string') record.gazetteDate = '2023-01-01';
  }
  return contract;
}

function expectFailure(
  result: Awaited<ReturnType<typeof loadTrialBackendContract>>,
  code: TrialBackendContractErrorCode,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe(code);
  expect(Object.keys(result).sort()).toEqual(['code', 'message', 'ok']);
}

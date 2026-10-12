import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPendingRunRequest, signalApi } from './api';
import { fictionalRun } from './fixtures';
import { installPendingLocks } from './pending-locks.test-support';

const watchId = 'FIXTURE-WATCH-PENDING';
const oldRequest = 'FIXTURE-REQUEST-REJECTED';
const newRequest = 'FIXTURE-REQUEST-EXPLICIT';
const csrf = 'FIXTURE-CSRF';
const fixedRejections = [[503, 'RUNS_DISABLED'], [409, 'RUN_IN_PROGRESS']] as const;
const rejected = (status: number, code: string) => Response.json({
  schemaVersion: '2.3.0', error: { code },
}, { status });
const saved = {
  ...structuredClone(fictionalRun), watchId,
  input: { watch: { ...fictionalRun.input.watch, id: watchId } },
};

beforeEach(() => {
  installPendingLocks();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    get length() { return values.size; },
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('confirmed pre-admission rejection', () => {
  it.each(fixedRejections)('clears only the fresh rejected request for HTTP %s/%s', async (status, code) => {
    const fetcher = vi.fn().mockResolvedValueOnce(rejected(status, code))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(Response.json(saved));
    vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start(watchId, 'check', oldRequest, csrf)).rejects.toMatchObject({ code: String(status) });
    expect(readPendingRunRequest()).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(signalApi.requestRun(watchId, oldRequest)).rejects.toMatchObject({ code: '404' });
    expect(readPendingRunRequest()).toBeNull();
    vi.resetModules();
    const reloaded = await import('./api');
    expect(reloaded.readPendingRunRequest()).toBeNull();
    expect(fetcher.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
    expect(await reloaded.signalApi.start(watchId, 'check', newRequest, csrf)).toEqual(saved);
    expect(fetcher.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(2);
    expect(JSON.parse(fetcher.mock.calls[2][1].body).requestId).toBe(newRequest);
  });

  for (const [status, code] of fixedRejections) {
    it.each([
      { watchId, requestId: newRequest },
      { watchId: 'FIXTURE-WATCH-OTHER', requestId: oldRequest },
    ])(`keeps another tab's pending on late ${status}/${code}`, async (newer) => {
      let respond: (response: Response) => void = () => { throw new Error('FIXTURE-NOT-SENT'); };
      const fetcher = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { respond = resolve; }));
      vi.stubGlobal('fetch', fetcher);
      const request = signalApi.start(watchId, 'check', oldRequest, csrf);
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
      const key = vi.mocked(localStorage.setItem).mock.calls[0][0];
      localStorage.removeItem(key);
      localStorage.setItem(`kiriko-design-signals-pending-request:${encodeURIComponent(newer.watchId)}:${newer.requestId}`, JSON.stringify(newer));
      respond(rejected(status, code));
      await expect(request).rejects.toMatchObject({ code: String(status) });
      expect(readPendingRunRequest()).toEqual(newer);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  }

  it.each([
    [503, 'SERVICE_UNAVAILABLE'], [409, 'REQUEST_CONFLICT'], [409, 'RUN_INTERRUPTED'],
    [503, 'FIXTURE-UNKNOWN'], [409, 'FIXTURE-UNKNOWN'],
    [409, 'RUNS_DISABLED'], [503, 'RUN_IN_PROGRESS'],
  ] as const)('keeps uncertainty for HTTP %s/%s', async (status, code) => {
    const fetcher = vi.fn().mockResolvedValue(rejected(status, code));
    vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start(watchId, 'check', oldRequest, csrf)).rejects.toMatchObject({ code: String(status) });
    expect(readPendingRunRequest()).toEqual({ watchId, requestId: oldRequest });
    await expect(signalApi.start(watchId, 'check', newRequest, csrf)).rejects.toMatchObject({ code: 'pending' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['', 'application/json'], ['{broken', 'application/json'],
    [JSON.stringify({ schemaVersion: '1.0.0', error: { code: 'RUNS_DISABLED' } }), 'application/json'],
    [JSON.stringify({ schemaVersion: '2.3.0', error: { code: ['RUNS_DISABLED'] } }), 'application/json'],
    [JSON.stringify({ schemaVersion: '2.3.0', error: null }), 'application/json'],
    [JSON.stringify({ schemaVersion: '2.3.0', error: { code: 'RUNS_DISABLED', detail: 'FIXTURE-UNSAFE-DIAGNOSTIC' } }), 'application/json'],
    [JSON.stringify({ schemaVersion: '2.3.0', error: { code: 'RUNS_DISABLED' } }), 'text/plain'],
    [' '.repeat(4097), 'application/json'],
  ])('keeps pending for malformed/unrecognized body case %#', async (body, contentType) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(body, { status: 503, headers: { 'Content-Type': contentType } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start(watchId, 'check', oldRequest, csrf)).rejects.toMatchObject({ code: '503' });
    expect(readPendingRunRequest()).toEqual({ watchId, requestId: oldRequest });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(fixedRejections)('does not clear recovered uncertainty from GET %s/%s', async (status, code) => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('FIXTURE-CONNECTION-LOST'))
      .mockResolvedValueOnce(rejected(status, code));
    vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start(watchId, 'check', oldRequest, csrf)).rejects.toMatchObject({ code: 'connection' });
    await expect(signalApi.requestRun(watchId, oldRequest)).rejects.toMatchObject({ code: String(status) });
    expect(readPendingRunRequest()).toEqual({ watchId, requestId: oldRequest });
    await expect(signalApi.start(watchId, 'check', newRequest, csrf)).rejects.toMatchObject({ code: 'pending' });
    expect(fetcher.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
  });

  it('keeps pending when a rejection body cannot be read', async () => {
    const response = rejected(503, 'RUNS_DISABLED');
    vi.spyOn(response, 'text').mockRejectedValueOnce(new TypeError('FIXTURE-BODY-LOST'));
    const fetcher = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start(watchId, 'check', oldRequest, csrf)).rejects.toMatchObject({ code: '503' });
    expect(readPendingRunRequest()).toEqual({ watchId, requestId: oldRequest });
    await expect(signalApi.start(watchId, 'check', newRequest, csrf)).rejects.toMatchObject({ code: 'pending' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

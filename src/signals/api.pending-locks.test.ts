import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPendingRunRequest, signalApi } from './api';
import { fictionalRun } from './fixtures';
import { installPendingLocks } from './pending-locks.test-support';

const storageKey = 'kiriko-design-signals-pending-request';
const first = { watchId: 'FIXTURE-WATCH-LOCK-A', requestId: 'FIXTURE-REQUEST-LOCK-A' };
const next = { watchId: 'FIXTURE-WATCH-LOCK-B', requestId: 'FIXTURE-REQUEST-LOCK-B' };
const saved = { ...structuredClone(fictionalRun), watchId: first.watchId, input: { watch: { ...fictionalRun.input.watch, id: first.watchId } } };
const rejection = (status: number, code: string) => Response.json({ schemaVersion: '2.3.0', error: { code } }, { status });

describe('pending requests use one origin-wide exclusive storage lock', () => {
  let values: Map<string, string>;
  let locks: ReturnType<typeof installPendingLocks>;
  beforeEach(() => {
    values = new Map(); locks = installPendingLocks();
    vi.stubGlobal('localStorage', {
      get length() { return values.size; },
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  async function otherTab() {
    vi.resetModules();
    return (await import('./api')).signalApi;
  }

  it('serializes two simultaneous fresh reservations and sends only the first request', async () => {
    const other = await otherTab();
    const fetcher = vi.fn().mockRejectedValue(new TypeError('FIXTURE-RESPONSE-LOST'));
    vi.stubGlobal('fetch', fetcher);
    const original = signalApi.start(first.watchId, 'check', first.requestId, 'FIXTURE-CSRF').catch((error: unknown) => error);
    const blocked = other.start(first.watchId, 'check', next.requestId, 'FIXTURE-CSRF').catch((error: unknown) => error);
    expect(await original).toMatchObject({ code: 'connection' });
    expect(await blocked).toMatchObject({ code: 'pending' });
    expect(readPendingRunRequest()).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new Set(locks.mock.calls.map(([name]) => name)).size).toBe(1);
    expect(locks.mock.calls.every(([, options]) => options.mode === 'exclusive')).toBe(true);
  });

  it.each([[503, 'RUNS_DISABLED'], [409, 'RUN_IN_PROGRESS']] as const)('preserves a writer queued just after the rejection comparison read for %s/%s', async (status, code) => {
    const other = await otherTab();
    let respond!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { respond = resolve; }))
      .mockRejectedValue(new TypeError('FIXTURE-NEXT-RESPONSE-LOST'));
    vi.stubGlobal('fetch', fetcher);
    const original = signalApi.start(first.watchId, 'check', first.requestId, 'FIXTURE-CSRF').catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    let queued: Promise<unknown> | undefined;
    let armed = true;
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      const value = values.get(key) ?? null;
      if (armed && key.startsWith(`${storageKey}:`) && value === JSON.stringify(first)) {
        armed = false;
        queued = other.start(next.watchId, 'check', next.requestId, 'FIXTURE-CSRF').catch((error: unknown) => error);
        // 第二のmutatorは同じlock内へ入れず、旧値の比較と解除が終わるまで待機する。
        expect(values.get(key)).toBe(JSON.stringify(first));
      }
      return value;
    });
    respond(rejection(status, code));
    expect(await original).toMatchObject({ code: String(status), preAdmissionRejected: true });
    expect(queued).toBeDefined();
    expect(await queued).toMatchObject({ code: 'connection' });
    expect(readPendingRunRequest()).toEqual(next);
    expect(fetcher).toHaveBeenCalledTimes(2); // 二つとも利用者による明示要求。自動再送ではない。
    expect(localStorage.removeItem).toHaveBeenCalledTimes(1);
  });

  it('preserves a writer queued inside a terminal legacy GET comparison and leaves network outside the lock', async () => {
    const other = await otherTab();
    values.set(storageKey, JSON.stringify(first));
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(saved)).mockRejectedValue(new TypeError('FIXTURE-NEXT-RESPONSE-LOST'));
    vi.stubGlobal('fetch', fetcher);
    let queued: Promise<unknown> | undefined;
    let armed = true;
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      const value = values.get(key) ?? null;
      if (armed && key === storageKey && value === JSON.stringify(first)) {
        armed = false;
        queued = other.start(next.watchId, 'check', next.requestId, 'FIXTURE-CSRF').catch((error: unknown) => error);
      }
      return value;
    });
    expect(await signalApi.requestRun(first.watchId, first.requestId)).toEqual(saved);
    expect(await queued).toMatchObject({ code: 'connection' });
    expect(readPendingRunRequest()).toEqual(next);
    expect(fetcher.mock.calls[0][1].method).toBeUndefined();
    expect(fetcher.mock.calls[1][1].method).toBe('POST');
  });

  it('keeps a newer request written by another participating tab before a late response acquires its lock', async () => {
    const other = await otherTab();
    let respond!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { respond = resolve; }))
      .mockResolvedValueOnce(Response.json(saved)).mockRejectedValue(new TypeError('FIXTURE-NEXT-RESPONSE-LOST'));
    vi.stubGlobal('fetch', fetcher);
    const late = signalApi.start(first.watchId, 'check', first.requestId, 'FIXTURE-CSRF').catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(await other.requestRun(first.watchId, first.requestId)).toEqual(saved);
    await expect(other.start(next.watchId, 'check', next.requestId, 'FIXTURE-CSRF')).rejects.toMatchObject({ code: 'connection' });
    respond(rejection(503, 'RUNS_DISABLED'));
    expect(await late).toMatchObject({ code: '503' });
    expect(readPendingRunRequest()).toEqual(next);
    expect(localStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(2);
  });

  it.each(['unsupported', 'lock-failure'] as const)('blocks fresh POST without changing existing pending when locks are %s', async (kind) => {
    values.set(storageKey, JSON.stringify(first));
    if (kind === 'unsupported') vi.stubGlobal('navigator', {});
    else locks.mockRejectedValueOnce(new Error('FIXTURE-LOCK-FAILED'));
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start(next.watchId, 'check', next.requestId, 'FIXTURE-CSRF')).rejects.toMatchObject({ code: 'pending-lock', requestNotSent: true });
    expect(readPendingRunRequest()).toEqual(first);
    expect(localStorage.setItem).not.toHaveBeenCalled(); expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps normal saved-result GETs usable without locks and retains legacy pending instead of deleting it', async () => {
    values.set(storageKey, JSON.stringify(first));
    vi.stubGlobal('navigator', {});
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(saved))
      .mockResolvedValueOnce(Response.json({ schemaVersion: '1.0.0', runs: [saved] })).mockResolvedValueOnce(Response.json(saved));
    vi.stubGlobal('fetch', fetcher);
    expect(await signalApi.run(saved.id)).toEqual(saved);
    expect(await signalApi.runs(first.watchId)).toEqual([saved]);
    await expect(signalApi.requestRun(first.watchId, first.requestId)).rejects.toMatchObject({ code: 'pending-lock', requestNotSent: false });
    expect(readPendingRunRequest()).toEqual(first);
    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.every(([, options]) => options.method === undefined)).toBe(true);
  });

  it('retains the sent request if the lock becomes unavailable before terminal cleanup', async () => {
    const fetcher = vi.fn().mockImplementation(() => {
      locks.mockRejectedValueOnce(new Error('FIXTURE-CLEANUP-LOCK-FAILED'));
      return Promise.resolve(Response.json(saved));
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start(first.watchId, 'check', first.requestId, 'FIXTURE-CSRF')).rejects.toMatchObject({ code: 'pending-lock', requestNotSent: false });
    expect(readPendingRunRequest()).toEqual(first);
    expect(localStorage.removeItem).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reloads legacy uncertainty without migrating its value, clearing GET404, or resending', async () => {
    const original = JSON.stringify(first); values.set(storageKey, original);
    const reloaded = await otherTab();
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 404 })); vi.stubGlobal('fetch', fetcher);
    await expect(reloaded.requestRun(first.watchId, first.requestId)).rejects.toMatchObject({ code: '404' });
    await expect(reloaded.start(first.watchId, 'check', next.requestId, 'FIXTURE-CSRF')).rejects.toMatchObject({ code: 'pending' });
    expect(values.get(storageKey)).toBe(original);
    expect(localStorage.setItem).not.toHaveBeenCalled(); expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][1].method).toBeUndefined();
  });
});

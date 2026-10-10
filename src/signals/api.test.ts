import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPendingRunRequest, signalApi, SignalApiError } from './api';
import { fictionalBootstrap, fictionalRun } from './fixtures';
import { fictionalPairsResponse, fictionalRunV22 } from './fixtures-v22';
import { installPendingLocks } from './pending-locks.test-support';

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
describe('signal same-origin API boundary', () => {
  it('uses GET only to bootstrap and restore history and run', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(fictionalBootstrap)).mockResolvedValueOnce(Response.json({ schemaVersion: '1.0.0', runs: [fictionalRun] })).mockResolvedValueOnce(Response.json(fictionalRun));
    vi.stubGlobal('fetch', fetcher);
    await signalApi.bootstrap(); await signalApi.runs('watch-example'); await signalApi.run('run-example');
    for (const [url, options] of fetcher.mock.calls) {
      expect(url).toMatch(/^\/api\/v1\//);
      expect(options.method).toBeUndefined();
      expect(options.credentials).toBe('same-origin');
      expect(options.cache).toBe('no-store');
      expect(options.redirect).toBe('error');
    }
  });
  it('sends csrf and an explicit idempotency key only for requested run creation', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(fictionalRun));
    vi.stubGlobal('fetch', fetcher);
    await signalApi.start('watch-example', 'check', 'same-request-id', 'fictional-csrf');
    expect(fetcher).toHaveBeenCalledWith('/api/v1/watches/watch-example/runs', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-CSRF-Token': 'fictional-csrf' }), body: JSON.stringify({ intent: 'check', requestId: 'same-request-id' }) }));
  });
  it('loads scoped pair candidates with GET and sends only the chosen ID on explicit run', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(fictionalPairsResponse)).mockResolvedValueOnce(Response.json(fictionalRunV22));
    vi.stubGlobal('fetch', fetcher);
    const watch = fictionalRunV22.input.watch;
    expect((await signalApi.comparisonPairs(watch)).comparisonPairs[0].id).toBe('fixture-pair-one');
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/watches/${watch.id}/comparison-pairs`);
    expect(fetcher.mock.calls[0][1].method).toBeUndefined();
    await signalApi.start(watch.id, 'check', 'selected-request', 'fictional-csrf', 'fixture-pair-one');
    expect(fetcher.mock.calls[1][0]).toBe(`/api/v1/watches/${watch.id}/runs`);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ intent: 'check', requestId: 'selected-request', comparisonPairId: 'fixture-pair-one' });
  });
  it.each([401, 403])('preserves comparison-pair authentication status %s for reauthentication', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private backend details', { status })));
    await expect(signalApi.comparisonPairs(fictionalRunV22.input.watch)).rejects.toMatchObject({
      code: String(status),
      message: expect.stringContaining('再読み込み'),
    });
  });
  it.each([401, 403, 404, 409, 429, 500])('handles HTTP %s without showing private error bodies', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private backend details', { status })));
    await expect(signalApi.bootstrap()).rejects.toBeInstanceOf(SignalApiError);
    await expect(signalApi.bootstrap()).rejects.not.toThrow('private backend details');
  });
  it('rejects SPA fallback HTML and malformed data instead of sample fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>fallback</html>')));
    await expect(signalApi.bootstrap()).rejects.toThrow('表示を停止');
  });
});

describe('uncertain run request recovery without POST resend', () => {
  it('retains only request identifiers after a network failure and blocks the same watch after reload', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('network disconnected'));
    vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start('watch-example', 'reanalyze', 'request-lost', 'private-csrf')).rejects.toMatchObject({ code: 'connection' });
    expect(readPendingRunRequest()).toEqual({ watchId: 'watch-example', requestId: 'request-lost' });
    expect(localStorage.setItem).toHaveBeenCalledWith(expect.any(String), JSON.stringify({ watchId: 'watch-example', requestId: 'request-lost' }));
    // 新しいmodule instanceにも結果やtokenを渡さず、ブラウザに残る要求IDから復帰する。
    vi.resetModules();
    const reloaded = await import('./api');
    expect(reloaded.readPendingRunRequest()).toEqual({ watchId: 'watch-example', requestId: 'request-lost' });
    await expect(reloaded.signalApi.start('watch-example', 'reanalyze', 'request-lost', 'private-csrf')).rejects.toMatchObject({ code: 'pending' });
    await expect(reloaded.signalApi.start('watch-example', 'check', 'request-new', 'private-csrf')).rejects.toMatchObject({ code: 'pending' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps the request pending when lookup is absent or running, then resolves its exact terminal result with GET', async () => {
    const running = { ...structuredClone(fictionalRun), status: 'running', completedAt: null, signal: null };
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(Response.json(running))
      .mockResolvedValueOnce(Response.json(fictionalRun));
    vi.stubGlobal('fetch', fetcher);
    const original = JSON.stringify(fictionalRun);
    await expect(signalApi.start('watch-example', 'reanalyze', 'request-lost', 'csrf')).rejects.toMatchObject({ code: 'connection' });
    await expect(signalApi.requestRun('watch-example', 'request-lost')).rejects.toMatchObject({ code: '404' });
    expect(readPendingRunRequest()?.requestId).toBe('request-lost');
    expect((await signalApi.requestRun('watch-example', 'request-lost')).status).toBe('running');
    expect(readPendingRunRequest()?.requestId).toBe('request-lost');
    expect(await signalApi.requestRun('watch-example', 'request-lost')).toEqual(fictionalRun);
    expect(readPendingRunRequest()).toBeNull();
    for (const [url, options] of fetcher.mock.calls.slice(1)) {
      expect(url).toBe('/api/v1/watches/watch-example/requests/request-lost');
      expect(options.method).toBeUndefined();
    }
    expect(JSON.stringify(fictionalRun)).toBe(original);
  });

  it.each(['failed', 'partial', 'interrupted'] as const)('resolves a saved %s result without claiming success or replaying analysis', async (status) => {
    const saved = { ...structuredClone(fictionalRun), status, errorCode: 'FIXTURE_STOPPED' };
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('response lost')).mockResolvedValueOnce(Response.json(saved));
    vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start('watch-example', 'reanalyze', 'request-lost', 'csrf')).rejects.toMatchObject({ code: 'connection' });
    expect(await signalApi.requestRun('watch-example', 'request-lost')).toEqual(saved);
    expect(readPendingRunRequest()).toBeNull();
    expect(fetcher.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
  });

  it.each([409, 500, 503])('does not treat HTTP %s as proof that no run was admitted', async (status) => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status }));
    vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start('watch-example', 'reanalyze', 'request-uncertain', 'csrf')).rejects.toMatchObject({ code: String(status) });
    expect(readPendingRunRequest()?.requestId).toBe('request-uncertain');
    await expect(signalApi.start('watch-example', 'reanalyze', 'request-new', 'csrf')).rejects.toMatchObject({ code: 'pending' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retains uncertainty after invalid response data and cannot clear it with another watch or request', async () => {
    const other = { ...structuredClone(fictionalRun), watchId: 'watch-other', input: { watch: { ...fictionalRun.input.watch, id: 'watch-other' } } };
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ invalid: true }))
      .mockResolvedValueOnce(Response.json(other)).mockResolvedValueOnce(Response.json(fictionalRun));
    vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start('watch-example', 'check', 'request-lost', 'csrf')).rejects.toThrow('表示を停止');
    await expect(signalApi.requestRun('watch-example', 'request-lost')).rejects.toThrow('表示を停止');
    await signalApi.requestRun('watch-example', 'unrelated-request');
    expect(readPendingRunRequest()?.requestId).toBe('request-lost');
  });

  it.each([400, 401, 403, 404, 413, 422, 429])('allows a corrected request after known pre-admission rejection HTTP %s', async (status) => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status })).mockResolvedValueOnce(Response.json(fictionalRun));
    vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.start('watch-example', 'check', 'request-rejected', 'csrf')).rejects.toMatchObject({ code: String(status) });
    expect(readPendingRunRequest()).toBeNull();
    await signalApi.start('watch-example', 'check', 'request-corrected', 'csrf');
    expect(readPendingRunRequest()).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('fails before POST when browser storage cannot preserve the request across reload', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('storage disabled'); });
    await expect(signalApi.start('watch-example', 'check', 'request-new', 'csrf')).rejects.toMatchObject({ code: 'pending-storage' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fails closed on damaged pending metadata without deleting or resending it', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.mocked(localStorage.getItem).mockReturnValue('{broken');
    await expect(signalApi.start('watch-example', 'check', 'request-new', 'csrf')).rejects.toMatchObject({ code: 'pending-storage' });
    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requires pending metadata readback before POST when storage silently drops a write', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.mocked(localStorage.setItem).mockImplementation(() => undefined);
    await expect(signalApi.start('watch-example', 'check', 'request-new', 'csrf')).rejects.toMatchObject({ code: 'pending-storage' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('retains the resolved terminal outcome when the independent history GET fails', async () => {
    const saved = { ...structuredClone(fictionalRun), id: 'run-recovered' };
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce(Response.json(saved)).mockResolvedValueOnce(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetcher);
    const original = JSON.stringify(fictionalRun);
    await expect(signalApi.start('watch-example', 'reanalyze', 'request-lost', 'csrf')).rejects.toMatchObject({ code: 'connection' });
    const recovered = await signalApi.requestRun('watch-example', 'request-lost');
    expect(readPendingRunRequest()).toBeNull();
    await expect(signalApi.runs('watch-example')).rejects.toMatchObject({ code: '503' });
    expect(recovered).toEqual(saved);
    expect(readPendingRunRequest()).toBeNull();
    expect(JSON.stringify(fictionalRun)).toBe(original);
    expect(fetcher.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
  });

  it.each([200, 422])('does not erase another tab\'s newer pending request on a late HTTP %s response', async (status) => {
    let respond: (response: Response) => void = () => { throw new Error('request was not sent'); };
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { respond = resolve; }));
    vi.stubGlobal('fetch', fetcher);
    const request = signalApi.start('watch-example', 'reanalyze', 'request-old', 'csrf');
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(readPendingRunRequest()?.requestId).toBe('request-old');
    const key = vi.mocked(localStorage.setItem).mock.calls[0][0];
    const newer = { watchId: 'watch-other', requestId: 'request-newer' };
    // 別のタブで旧要求を解決し、次の要求が保留された状態を再現する。
    localStorage.removeItem(key);
    localStorage.setItem(`kiriko-design-signals-pending-request:${encodeURIComponent(newer.watchId)}:${newer.requestId}`, JSON.stringify(newer));
    respond(status === 200 ? Response.json(fictionalRun) : new Response('', { status }));
    if (status === 200) expect(await request).toEqual(fictionalRun);
    else await expect(request).rejects.toMatchObject({ code: String(status) });
    expect(readPendingRunRequest()).toEqual(newer);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { signalApi, SignalApiError } from './api';
import { fictionalBootstrap, fictionalRun } from './fixtures';
import { fictionalPairsResponse, fictionalRunV22 } from './fixtures-v22';

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

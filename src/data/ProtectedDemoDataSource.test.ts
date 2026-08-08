import { describe, expect, it, vi } from 'vitest';
import { loadProtectedDemoData } from './ProtectedDemoDataSource';

const fixture = {
  recordCount: 1,
  records: [
    {
      id: 'protected-fixture-1',
      gazetteDate: '2026-06-01',
      sourceUpdateDate: '2026-06-02',
      designClass: 'S-N3-10',
      articleName: 'サンプル操作画面',
      applicants: ['サンプル企業'],
    },
  ],
};

describe('loadProtectedDemoData', () => {
  it('uses a same-origin request without accepting or storing credentials', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })) as unknown as typeof fetch;

    const loaded = await loadProtectedDemoData(fetchImpl);

    expect(loaded.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('/api/demo-designs', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      redirect: 'error',
    });
  });

  it('rejects cross-origin endpoints before making a request', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    const loaded = await loadProtectedDemoData(fetchImpl, 'https://example.test/demo-designs');

    expect(loaded.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not expose an error response body', async () => {
    const fetchImpl = vi.fn(async () => new Response('secret upstream detail', { status: 503 })) as unknown as typeof fetch;

    const loaded = await loadProtectedDemoData(fetchImpl);

    expect(loaded.ok).toBe(false);
    expect(JSON.stringify(loaded)).not.toContain('secret upstream detail');
  });
});

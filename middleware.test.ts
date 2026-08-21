import { describe, expect, it } from 'vitest';
import middleware from './middleware';

describe('Vercel trial middleware', () => {
  it('continues unauthenticated requests', () => {
    const response = middleware(createRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(response.headers.get('cache-control')).toBeNull();
  });

  it('keeps the trial Contract path uncached without authentication', () => {
    const response = middleware(createRequest('/api/trial/design-export'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});

function createRequest(pathname = '/'): Request {
  return new Request(`https://example.test${pathname}`, {
    headers: undefined,
  });
}

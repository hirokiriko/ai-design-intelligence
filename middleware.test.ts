import { afterEach, describe, expect, it, vi } from 'vitest';
import middleware from './middleware';

const TEST_USER = 'test-user';
const TEST_PASSWORD = 'test-password';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Vercel Basic authentication middleware', () => {
  it('fails closed when credentials are not configured', () => {
    vi.stubEnv('BASIC_AUTH_USER', '');
    vi.stubEnv('BASIC_AUTH_PASSWORD', '');

    const response = middleware(createRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('challenges requests without credentials', () => {
    configureCredentials();

    const response = middleware(createRequest());

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('Basic realm=');
    expect(response.headers.get('www-authenticate')).toContain('KIRIKO Design Signals');
  });

  it('rejects incorrect credentials', () => {
    configureCredentials();

    const response = middleware(createRequest(basicAuthorization(TEST_USER, 'wrong-password')));

    expect(response.status).toBe(401);
  });

  it('continues requests with correct credentials', () => {
    configureCredentials();

    const response = middleware(createRequest(basicAuthorization(TEST_USER, TEST_PASSWORD)));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');
  });
});

function configureCredentials(): void {
  vi.stubEnv('BASIC_AUTH_USER', TEST_USER);
  vi.stubEnv('BASIC_AUTH_PASSWORD', TEST_PASSWORD);
}

function createRequest(authorization?: string): Request {
  return new Request('https://example.test/', {
    headers: authorization ? { authorization } : undefined,
  });
}

function basicAuthorization(user: string, password: string): string {
  const bytes = new TextEncoder().encode(`${user}:${password}`);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return `Basic ${btoa(binary)}`;
}

import { next } from '@vercel/functions';

const BASIC_AUTH_REALM = 'KIRIKO Design Signals external verification';
const TRIAL_BACKEND_CONTRACT_PATH = '/api/trial/design-export';

export const config = {
  matcher: ['/', '/:path*'],
};

export default function middleware(request: Request): Response {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return new Response('Service unavailable', {
      status: 503,
      headers: protectedHeaders(),
    });
  }

  const credentials = parseBasicAuthorization(request.headers.get('authorization'));
  if (
    !credentials ||
    !constantTimeEqual(credentials.user, expectedUser) ||
    !constantTimeEqual(credentials.password, expectedPassword)
  ) {
    return new Response('Authentication required', {
      status: 401,
      headers: {
        ...protectedHeaders(),
        'WWW-Authenticate': `Basic realm="${BASIC_AUTH_REALM}", charset="UTF-8"`,
      },
    });
  }

  const responseHeaders: Record<string, string> = {
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  };
  if (new URL(request.url).pathname === TRIAL_BACKEND_CONTRACT_PATH) {
    responseHeaders['Cache-Control'] = 'private, no-store';
  }

  return next({ headers: responseHeaders });
}

function parseBasicAuthorization(header: string | null): { user: string; password: string } | null {
  const match = header?.match(/^Basic\s+([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;

  try {
    const binary = atob(match[1]);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const separator = decoded.indexOf(':');
    if (separator < 0) return null;

    return {
      user: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

function protectedHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'private, no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  };
}

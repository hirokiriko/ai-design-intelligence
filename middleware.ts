import { next } from '@vercel/functions';

const TRIAL_BACKEND_CONTRACT_PATH = '/api/trial/design-export';

export const config = {
  matcher: ['/', '/:path*'],
};

export default function middleware(request: Request): Response {
  const responseHeaders: Record<string, string> = {
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  };
  if (new URL(request.url).pathname === TRIAL_BACKEND_CONTRACT_PATH) {
    responseHeaders['Cache-Control'] = 'private, no-store';
  }

  return next({ headers: responseHeaders });
}

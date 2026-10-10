import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { createHash } from 'node:crypto';

// Private artifacts live outside the source tree and never enter a build/archive.
// This middleware is attached only to the loopback development server.
export function approvedPreviewPlugin() {
  const privateRoot = new URL('../../approved-evidence-private/', import.meta.url);
  return {
    name: 'kds-approved-saved-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
        const prefix = '/__signals-local-preview/approved/';
        const replayMediaPrefix = '/api/v1/media/';
        if (!pathname.startsWith(prefix) && !pathname.startsWith(replayMediaPrefix)) return next();
        if (!['GET', 'HEAD'].includes(request.method ?? '')) {
          response.statusCode = 405; response.end(); return;
        }
        try {
          const json = await readFile(new URL('preview.json', privateRoot));
          const preview = JSON.parse(json.toString('utf8'));
          let body, type;
          if (pathname === `${prefix}preview.json`) { body = json; type = 'application/json; charset=utf-8'; }
          else {
            const mediaPrefix = pathname.startsWith(prefix) ? `${prefix}media/` : replayMediaPrefix;
            if (!pathname.startsWith(mediaPrefix)) { response.statusCode = 404; response.end(); return; }
            const id = decodeURIComponent(pathname.slice(mediaPrefix.length));
            const media = preview.media.find((item) => item.id === id);
            if (!media || !['a.jpg', 'b.jpg'].includes(media.file)) {
              if (pathname.startsWith(replayMediaPrefix)) return next();
              response.statusCode = 404; response.end(); return;
            }
            body = await readFile(new URL(media.file, privateRoot));
            if (createHash('sha256').update(body).digest('hex') !== media.sha256) throw new Error('invalid_media');
            type = 'image/jpeg';
          }
          response.statusCode = 200;
          response.setHeader('Content-Type', type);
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('X-KDS-Data-Mode', 'approved_saved_read_only');
          response.end(request.method === 'HEAD' ? undefined : body);
        } catch {
          if (pathname.startsWith(replayMediaPrefix)) return next();
          response.statusCode = 503; response.setHeader('Cache-Control', 'no-store'); response.end('Saved preview unavailable');
        }
      });
    },
  };
}

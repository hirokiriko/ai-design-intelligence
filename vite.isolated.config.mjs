import react from '@vitejs/plugin-react';
import { URL } from 'node:url';
import { createFictionalMediaPng } from './scripts/signals-development-media.mjs';
import { approvedPreviewPlugin } from './scripts/approved-preview-middleware.mjs';

export default {
  base: './',
  server: { host: '127.0.0.1', port: 4189, strictPort: true },
  plugins: [react(), approvedPreviewPlugin(), {
    name: 'kds-fixture-development-media',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
        const prefix = '/api/v1/media/';
        if (!pathname.startsWith(prefix)) return next();
        const image = createFictionalMediaPng(pathname.slice(prefix.length));
        if (!image || !['GET', 'HEAD'].includes(request.method ?? '')) return next();
        response.statusCode = 200;
        response.setHeader('Content-Type', 'image/png');
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-KDS-Data-Mode', 'kds_fixture_local_development');
        response.end(request.method === 'HEAD' ? undefined : image);
      });
    },
  }],
  cacheDir: '.vite-isolated-cache',
};

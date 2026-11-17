import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

/** The headers for files that proxy.ts does not see. */
const STATIC_HEADERS = [
  { source: '/_next/static/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
  { source: '/_next/image/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
  { source: '/icon.svg', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
];

const config: NextConfig = {
  // The shared packages are TypeScript source, so Next compiles them with the app.
  transpilePackages: ['@buxa/domain', '@buxa/contracts', '@buxa/db', '@buxa/shared', '@buxa/server', '@buxa/middleware'],
  // Dependencies are hoisted to the repository root, so tell Turbopack where the workspace starts.
  turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) },
  // The original kanban demo lived at /kanban (its pages used #/ links, which never reach the server). It now lives under /camp.
  // The destination is ROUTES.camp (config/routes.ts); written out here because Next loads this file without importing app modules.
  async redirects() {
    return [
      { source: '/kanban', destination: '/camp', permanent: false },
      { source: '/kanban/:path*', destination: '/camp', permanent: false },
    ];
  },
  // proxy.ts skips these paths (its matcher excludes them), so they get their headers here. Only nosniff: the page CSP and the
  // other security headers are for pages. Caching is left to Next.js, which sets Cache-Control on these files itself.
  async headers() {
    return STATIC_HEADERS;
  },
};

export default config;

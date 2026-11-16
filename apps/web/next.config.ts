import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const dev = process.env.NODE_ENV !== 'production';
const LEGACY = process.env.BUXA_SERVER ?? 'http://127.0.0.1:8787'; // the original kanban demo's optional local server

/** The headers for files that proxy.ts does not see. */
const STATIC_HEADERS = [
  { source: '/_next/static/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
  { source: '/_next/image/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
  { source: '/icon.svg', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
];

const config: NextConfig = {
  // The shared packages are TypeScript source, so Next compiles them with the app.
  transpilePackages: ['@buxa/domain', '@buxa/contracts', '@buxa/db'],
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
  // Development only: the kanban demo can talk to its own optional server (`npm run server`) through this address.
  async rewrites() {
    if (!dev) return [];
    return [
      { source: '/api/:path*', destination: `${LEGACY}/api/:path*` },
      { source: '/mcp', destination: `${LEGACY}/mcp` },
    ];
  },
};

export default config;

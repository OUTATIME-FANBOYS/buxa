import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
import { settle } from '@buxa/domain';

const dev = process.env.NODE_ENV !== 'production';
const LOCAL_SERVER = process.env.BUXA_SERVER ?? 'http://127.0.0.1:8787'; // the local agent server (`npm run server`)

/** The headers for files that proxy.ts does not see. */
const STATIC_HEADERS = [
  { source: '/_next/static/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
  { source: '/_next/image/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
  { source: '/icon.svg', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
];

const config: NextConfig = {
  // The shared packages are TypeScript source, so Next compiles them with the app.
  transpilePackages: [
    '@buxa/domain',
    '@buxa/contracts',
    '@buxa/db',
    '@buxa/shared',
    '@buxa/server',
    '@buxa/middleware',
  ],
  // Dependencies are hoisted to the repository root, so tell Turbopack where the workspace starts.
  turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) },
  // Server actions read a form post in one piece, and Next's default cap is 1 MB: too small for a 1 MB file with its fields. The cap
  // is raised for every server action in the app, to fit a few uploads at once. Each file is still checked against 1 MB by the
  // service (see MAX_FORM_FILES and ATTACHMENT_MAX_BYTES). Route handlers keep their own limit. See docs/security.md, section 2.
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
  // /kanban redirects to /camp. Links with a #/ hash never reach the server, so this redirect only covers plain /kanban paths.
  // The destination is ROUTES.camp (config/routes.ts); written out here because Next loads this file without importing app modules.
  redirects() {
    return settle(() => {
      return [
        { source: '/kanban', destination: '/camp', permanent: false },
        { source: '/kanban/:path*', destination: '/camp', permanent: false },
        // /camp/classes moved to /camp/sessions. Permanent, so old bookmarks open the new address. The session-with-new-class
        // form comes first: its old address was /camp/classes/:id/sessions/new, now /camp/sessions/:id/classes/new.
        {
          source: '/camp/classes/:sessionId/sessions/new',
          destination: '/camp/sessions/:sessionId/classes/new',
          permanent: true,
        },
        // The Add person page is now a pop-up on the People page. Old links open that pop-up.
        { source: '/camp/people/new', destination: '/camp/people?add=person', permanent: true },
        { source: '/camp/classes', destination: '/camp/sessions', permanent: true },
        { source: '/camp/classes/:path*', destination: '/camp/sessions/:path*', permanent: true },
      ];
    });
  },
  // proxy.ts skips these paths (its matcher excludes them), so they get their headers here. Only nosniff: the page CSP and the
  // other security headers are for pages. Caching is left to Next.js, which sets Cache-Control on these files itself.
  headers() {
    return settle(() => {
      return STATIC_HEADERS;
    });
  },
  // Development only: the browser reaches the local agent server (`npm run server`) through this /api rewrite.
  rewrites() {
    return settle(() => {
      if (!dev) {
        return [];
      }

      return [
        { source: '/api/:path*', destination: `${LOCAL_SERVER}/api/:path*` },
        { source: '/mcp', destination: `${LOCAL_SERVER}/mcp` },
      ];
    });
  },
};

export default config;

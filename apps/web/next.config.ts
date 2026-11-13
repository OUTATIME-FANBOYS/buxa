import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const dev = process.env.NODE_ENV !== 'production';
const API = process.env.BUXA_API ?? 'http://127.0.0.1:8788';      // the Fastify API (until it moves into route handlers)
const LEGACY = process.env.BUXA_SERVER ?? 'http://127.0.0.1:8787'; // the original kanban demo's local server

const config: NextConfig = {
  // The shared packages are TypeScript source, so Next compiles them with the app.
  transpilePackages: ['@buxa/domain', '@buxa/contracts'],
  // Dependencies are hoisted to the repository root, so tell Turbopack where the workspace starts.
  turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) },
  // Development only: forward API calls to the separate servers, so the browser sees one origin.
  async rewrites() {
    if (!dev) return [];
    return [
      { source: '/v1/:path*', destination: `${API}/v1/:path*` },
      { source: '/health', destination: `${API}/health` },
      { source: '/ready', destination: `${API}/ready` },
      { source: '/api/:path*', destination: `${LEGACY}/api/:path*` },
      { source: '/mcp', destination: `${LEGACY}/mcp` },
    ];
  },
};

export default config;

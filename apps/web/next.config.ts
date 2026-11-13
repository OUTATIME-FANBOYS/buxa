import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const dev = process.env.NODE_ENV !== 'production';
const LEGACY = process.env.BUXA_SERVER ?? 'http://127.0.0.1:8787'; // the original kanban demo's optional local server

const config: NextConfig = {
  // The shared packages are TypeScript source, so Next compiles them with the app.
  transpilePackages: ['@buxa/domain', '@buxa/contracts', '@buxa/db'],
  // Dependencies are hoisted to the repository root, so tell Turbopack where the workspace starts.
  turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) },
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

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The shared packages (@buxa/*) are npm workspaces, so they resolve by name. `@/` is the web app's alias; `server-only` is a Next.js
// build-time guard that has no meaning under test.
const web = (path: string) => fileURLToPath(new URL(`./apps/web/${path}`, import.meta.url));
export default defineConfig({
  resolve: { alias: { '@/': `${web('')}`, 'server-only': fileURLToPath(new URL('./test/empty.ts', import.meta.url)) } },
});

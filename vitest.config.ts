import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

// The shared packages (@buxa/*) are npm workspaces, so they resolve by name. `@/` is the web app's alias; `server-only` is a Next.js
// build-time guard that has no meaning under test.
const web = (path: string) => fileURLToPath(new URL(`./apps/web/${path}`, import.meta.url));
export default defineConfig({
  // Other agents' and editors' working copies live in .claude/worktrees; their tests are not this project's tests.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
  // Components are written for React's automatic JSX runtime (as Next.js compiles them), so tests must compile them the same way.
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@/': `${web('')}`, 'server-only': fileURLToPath(new URL('./test/empty.ts', import.meta.url)) } },
});

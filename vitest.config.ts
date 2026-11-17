import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

// The shared packages (@buxa/*) are npm workspaces, and their paths are also aliased here so tests resolve them the way tsconfig
// does. `@/` is the web app's alias; `server-only` is a Next.js build-time guard that has no meaning under test.
const web = (path: string) => fileURLToPath(new URL(`./apps/web/${path}`, import.meta.url));
const pkg = (name: 'shared' | 'server' | 'middleware') => fileURLToPath(new URL(`./apps/${name}/src`, import.meta.url));
export default defineConfig({
  // Other agents' and editors' working copies live in .claude/worktrees; their tests are not this project's tests.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
  // Components are written for React's automatic JSX runtime (as Next.js compiles them), so tests must compile them the same way.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: '@/', replacement: `${web('')}` },
      { find: 'server-only', replacement: fileURLToPath(new URL('./test/empty.ts', import.meta.url)) },
      { find: /^@buxa\/shared$/, replacement: `${pkg('shared')}/index.ts` },
      { find: /^@buxa\/shared\/(.*)$/, replacement: `${pkg('shared')}/$1` },
      { find: /^@buxa\/server$/, replacement: `${pkg('server')}/index.ts` },
      { find: /^@buxa\/server\/(.*)$/, replacement: `${pkg('server')}/$1` },
      { find: /^@buxa\/middleware$/, replacement: `${pkg('middleware')}/index.ts` },
      { find: /^@buxa\/middleware\/(.*)$/, replacement: `${pkg('middleware')}/$1` },
    ],
  },
});

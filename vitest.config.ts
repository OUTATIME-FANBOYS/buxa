import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkg = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));
export default defineConfig({
  resolve: { alias: { '@buxa/domain': pkg('domain'), '@buxa/db': pkg('db'), '@buxa/contracts': pkg('contracts') } },
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@buxa/domain': fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url)) } },
});

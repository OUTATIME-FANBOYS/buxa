import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const LEGACY = process.env.BUXA_SERVER ?? 'http://127.0.0.1:8787'; // the old single-user kanban server
const API = process.env.BUXA_API ?? 'http://127.0.0.1:8788';       // the new Buxa API
// In development the browser talks to one origin; the dev server forwards API calls.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@buxa/domain': fileURLToPath(new URL('../../packages/domain/src/index.ts', import.meta.url)) } },
  server: { proxy: { '/api': LEGACY, '/mcp': LEGACY, '/v1': API } },
});

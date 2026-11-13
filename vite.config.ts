import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const SERVER = process.env.BUXA_SERVER ?? 'http://127.0.0.1:8787';
// In development the app talks to the local Buxa server through the dev server, so the browser sees one origin.
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': SERVER, '/mcp': SERVER } } });

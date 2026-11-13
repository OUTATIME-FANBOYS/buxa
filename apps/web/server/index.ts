import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';
const dataDir = path.resolve(process.env.BUXA_DATA ?? '.buxa-data');
const app = createApp({ dataDir, port, host, staticDir: fileURLToPath(new URL('../dist', import.meta.url)) });

app.listen().then(p => {
  console.log(`\n  Buxa server   http://localhost:${p}`);
  console.log(`  MCP endpoint  http://localhost:${p}/mcp`);
  console.log(`  Data          ${dataDir}`);
  console.log(`\n  Open the app, then Agents → your agent → Connect, to get a token for Claude.\n`);
});
const stop = () => { void app.close().then(() => process.exit(0)); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);

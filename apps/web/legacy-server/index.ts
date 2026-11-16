import path from 'node:path';
import { createApp, hostProblem, newRunSecret } from './app';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';
const dataDir = path.resolve(process.env.BUXA_DATA ?? '.buxa-data');

const problem = hostProblem(host, process.env.BUXA_ALLOW_REMOTE_HOST);
if (problem) { console.error(`\n  Refusing to start: ${problem}\n`); process.exit(1); }

// The secret every /api request must send. BUXA_LEGACY_SECRET keeps it fixed across restarts (for the browser's
// NEXT_PUBLIC_LEGACY_SECRET); otherwise a new one is made for each run and printed below.
const secret = process.env.BUXA_LEGACY_SECRET && process.env.BUXA_LEGACY_SECRET.length >= 16 ? process.env.BUXA_LEGACY_SECRET : newRunSecret();
const app = createApp({ dataDir, port, host, secret });

app.listen().then(p => {
  console.log(`\n  Buxa server   http://localhost:${p}`);
  console.log(`  MCP endpoint  http://localhost:${p}/mcp`);
  console.log(`  Data          ${dataDir}`);
  console.log(`  Run secret    ${secret}`);
  console.log(`                Sent as X-Buxa-Run-Secret on /api. The app reads it from NEXT_PUBLIC_LEGACY_SECRET.`);
  console.log(`\n  Open the app, then Agents → your agent → Connect, to get a token for Claude.\n`);
});
const stop = () => { void app.close().then(() => process.exit(0)); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);

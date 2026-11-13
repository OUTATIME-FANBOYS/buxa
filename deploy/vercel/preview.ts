/**
 * Runs the built `.vercel/output` locally (`npm run preview:vercel` after `npm run build:vercel`), applying the same route and
 * header rules from config.json. It approximates Vercel's router, so use it to check the artifact, then confirm on a real preview.
 * Needs the API's environment (DATABASE_URL, SUPABASE_URL, ...).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { OutputConfig } from './config';

const output = resolve('.vercel/output');
const staticDir = join(output, 'static');
const config = JSON.parse(readFileSync(join(output, 'config.json'), 'utf8')) as OutputConfig;
const { default: handler } = await import(pathToFileURL(join(output, 'functions', 'api.func', 'index.mjs')).href) as { default: (req: IncomingMessage, res: ServerResponse) => Promise<void> };

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png', '.woff2': 'font/woff2' };

function serveStatic(pathname: string, res: ServerResponse): boolean {
  const file = resolve(staticDir, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(staticDir + sep) || !existsSync(file) || !statSync(file).isFile()) return false;
  res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
  if (!res.hasHeader('cache-control')) res.setHeader('cache-control', 'public, max-age=0, must-revalidate');
  res.end(readFileSync(file));
  return true;
}

createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://local').pathname;
  for (const route of config.routes) {
    if (route.handle === 'filesystem') { if (serveStatic(pathname, res)) return; continue; }
    if (!route.src || !new RegExp(`^${route.src}$`).test(pathname)) continue;
    if (route.continue) { for (const [name, value] of Object.entries(route.headers ?? {})) res.setHeader(name, value); continue; }
    if (route.dest === '/api') { void handler(req, res); return; }
  }
  res.statusCode = 404; res.setHeader('content-type', 'text/plain'); res.end('Not found');
}).listen(Number(process.env.PORT ?? 4173), '127.0.0.1', () => console.log(`Preview at http://localhost:${process.env.PORT ?? 4173}`));

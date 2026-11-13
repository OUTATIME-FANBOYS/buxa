import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isData } from '../src/lib/dataSlices';
import * as A from '../src/lib/agents';
import { Store, Tokens } from './store';
import { buildMcp } from './mcp';

export interface AppOptions { dataDir: string; port?: number; host?: string; staticDir?: string }
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/i;
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

/** Read a request body, refusing anything larger than `limit` bytes. */
function body(req: http.IncomingMessage, limit: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0;
    req.on('data', (c: Buffer) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Request too large.'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined); } catch { reject(Object.assign(new Error('Body is not valid JSON.'), { status: 400 })); } });
    req.on('error', reject);
  });
}
const send = (res: http.ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(value));
};

export function createApp(opts: AppOptions) {
  const store = new Store(opts.dataDir); const tokens = new Tokens(opts.dataDir);
  const sse = new Set<http.ServerResponse>();
  store.subscribe((version, origin) => { for (const r of sse) r.write(`event: version\ndata: ${JSON.stringify({ version, origin })}\n\n`); });
  const beat = setInterval(() => { for (const r of sse) r.write(': keep-alive\n\n'); }, 25_000); beat.unref();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://local');
      // DNS-rebinding guard: only answer requests addressed to this machine.
      const hostName = (req.headers.host ?? '').replace(/:\d+$/, '');
      if (!LOCAL.test(hostName)) return send(res, 403, { error: 'This server only answers on localhost.' });
      const origin = req.headers.origin;
      if (origin) { try { if (!LOCAL.test(new URL(origin).hostname)) return send(res, 403, { error: 'Cross-site requests are not allowed.' }); } catch { return send(res, 403, { error: 'Bad origin.' }); } }

      if (url.pathname === '/mcp') return await mcp(req, res);
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      return serveStatic(req, res, url);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      if (!res.headersSent) send(res, status, { error: status === 500 ? 'Internal error.' : (e as Error).message });
      if (status === 500) console.error(e);
    }
  });

  /* ---------- MCP: bearer token -> agent -> tools bound to that agent ---------- */
  async function mcp(req: http.IncomingMessage, res: http.ServerResponse) {
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
    const agentId = m ? tokens.verify(m[1]) : null;
    const snap = store.snapshot;
    if (!agentId || (snap && !A.agentOf(snap, agentId))) return send(res, 401, { jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized. Create a connection for this agent in Buxa and send its token as a Bearer token.' }, id: null }, { 'www-authenticate': 'Bearer' });
    if (req.method !== 'POST') return send(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }, { allow: 'POST' });
    const parsed = await body(req, 256 * 1024);
    const mcpServer = buildMcp(store, agentId);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void mcpServer.close(); });
    await mcpServer.connect(transport); await transport.handleRequest(req, res, parsed);
  }

  /* ---------- API for the app ---------- */
  async function api(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    const write = req.method !== 'GET' && req.method !== 'HEAD';
    // A custom header cannot be sent cross-site without a preflight, which this server never grants.
    if (write && !req.headers['x-buxa-client']) return send(res, 400, { error: 'Missing X-Buxa-Client header.' });
    const client = String(req.headers['x-buxa-client'] ?? 'anon').slice(0, 40);

    if (url.pathname === '/api/health') return send(res, 200, { ok: true, hasData: store.hasData, version: store.version, mcpUrl: `http://localhost:${port()}/mcp` });

    if (url.pathname === '/api/state') {
      if (req.method === 'GET') return send(res, 200, store.hasData ? { version: store.version, data: store.data } : { version: store.version, empty: true });
      if (req.method === 'PUT') {
        const b = (await body(req, 40 * 1024 * 1024)) as { baseVersion?: number; data?: unknown } | undefined;
        if (!b || typeof b.baseVersion !== 'number' || !isData(b.data)) return send(res, 400, { error: 'Expected { baseVersion, data }.' });
        const v = store.put(b.baseVersion, b.data, client);
        return v === null ? send(res, 409, { error: 'The server has newer data.', version: store.version }) : send(res, 200, { version: v });
      }
    }

    if (url.pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(`event: version\ndata: ${JSON.stringify({ version: store.version, origin: 'hello' })}\n\n`);
      sse.add(res); req.on('close', () => sse.delete(res)); return;
    }

    const t = /^\/api\/agents\/([^/]+)\/token$/.exec(url.pathname);
    if (t) {
      const agentId = decodeURIComponent(t[1]); const snap = store.snapshot;
      if (!snap || !A.agentOf(snap, agentId)) return send(res, 404, { error: 'No such agent.' });
      if (req.method === 'GET') return send(res, 200, tokens.info(agentId));
      if (req.method === 'POST') return send(res, 200, { token: tokens.issue(agentId), ...tokens.info(agentId) });
      if (req.method === 'DELETE') { tokens.revoke(agentId); return send(res, 200, tokens.info(agentId)); }
    }
    return send(res, 404, { error: 'Not found.' });
  }

  function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    const root = opts.staticDir && fs.existsSync(opts.staticDir) ? path.resolve(opts.staticDir) : null;
    if (!root || (req.method !== 'GET' && req.method !== 'HEAD')) return send(res, 404, { error: 'Not found. Run the app with `npm run dev`, or build it and use `npm start`.' });
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) && file !== root) return send(res, 403, { error: 'Forbidden.' });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  }

  const port = () => (server.address() as AddressInfo | null)?.port ?? opts.port ?? 0;
  const listen = () => new Promise<number>(r => server.listen(opts.port ?? 0, opts.host ?? '127.0.0.1', () => r(port())));
  const close = async () => { clearInterval(beat); for (const r of sse) r.end(); store.flush(); tokens.flush(); await new Promise<void>(r => { server.close(() => r()); server.closeAllConnections(); }); };
  return { server, store, tokens, listen, close, port };
}

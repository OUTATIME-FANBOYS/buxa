import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

const realFetch = fetch; // keep a handle: some tests replace the global fetch the API uses to ask Supabase
const BASE_ENV = { DATABASE_URL: 'postgres://u:p@127.0.0.1:1/none', LOG_LEVEL: 'silent' };

async function serve(env: Record<string, string>, supabaseSettings?: unknown) {
  vi.resetModules();
  for (const [name, value] of Object.entries({ ...BASE_ENV, ...env })) vi.stubEnv(name, value);
  if (supabaseSettings !== undefined) vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(supabaseSettings))));
  const { default: handler } = await import('../src/vercel');
  const server = http.createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { get: (path: string) => realFetch(base + path), close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('the Vercel function entry', () => {
  it('serves the Fastify app over real HTTP, with its headers and request id', async () => {
    const s = await serve({ NODE_ENV: 'test' });
    const r = await s.get('/health');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'ok' });
    expect(r.headers.get('x-request-id')).toBeTruthy();
    expect(r.headers.get('cache-control')).toBe('no-store');
    await s.close();
  });

  it('has no /v1 routes when no identity provider is configured', async () => {
    const s = await serve({ NODE_ENV: 'test' });
    expect((await s.get('/v1/me')).status).toBe(404);
    await s.close();
  });

  it('answers 503 in production when Supabase auto-confirms sign-ups, and never reaches the app', async () => {
    const s = await serve({ NODE_ENV: 'production', SUPABASE_URL: 'https://p.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }, { mailer_autoconfirm: true });
    for (const path of ['/health', '/v1/me']) {
      const r = await s.get(path);
      expect(r.status, path).toBe(503);
      expect((await r.json()).error.code).toBe('internal');
    }
    await s.close();
  });

  it('serves normally in production when email confirmation is required', async () => {
    const s = await serve({ NODE_ENV: 'production', SUPABASE_URL: 'https://p.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }, { mailer_autoconfirm: false });
    expect((await s.get('/health')).status).toBe(200);
    expect((await s.get('/v1/me')).status).toBe(401); // the API is live and asks for a token
    await s.close();
  });

  it('fails loudly at load when configuration is missing, instead of half-working', async () => {
    vi.resetModules();
    vi.stubEnv('DATABASE_URL', '');
    await expect(import('../src/vercel')).rejects.toThrow(/Invalid configuration/);
  });
});

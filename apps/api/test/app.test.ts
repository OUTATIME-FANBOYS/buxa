import { afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';

const url = process.env.DATABASE_URL;
const cfg = { LOG_LEVEL: 'info' as const, NODE_ENV: 'test' as const };
const lines: string[] = [];
const stream = { write: (l: string) => { lines.push(l); } };

describe('config', () => {
  it('applies defaults', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://x/y' })).toMatchObject({ PORT: 8788, HOST: '127.0.0.1', LOG_LEVEL: 'info', NODE_ENV: 'development' });
  });
  it('fails with every problem listed and no secret echoed', () => {
    const msg = (() => { try { loadConfig({ PORT: '99999', DATABASE_URL: 'mysql://user:hunter2@h/db' }); } catch (e) { return (e as Error).message; } return ''; })();
    expect(msg).toMatch(/PORT/); expect(msg).toMatch(/DATABASE_URL/);
    try { loadConfig({ DATABASE_URL: 'mysql://user:hunter2@h/db' }); } catch (e) { expect((e as Error).message).not.toContain('hunter2'); }
  });
  it('requires DATABASE_URL', () => { expect(() => loadConfig({})).toThrow(/DATABASE_URL: is required/); });
});

describe('http skeleton', () => {
  const dead = new pg.Pool({ connectionString: 'postgres://u:p@127.0.0.1:1/none', connectionTimeoutMillis: 500 });
  const app = buildApp({ config: cfg, pool: dead, logStream: stream });
  afterAll(async () => { await app.close(); await dead.end().catch(() => {}); });

  it('/health answers without a database', async () => {
    const r = await app.inject('/health');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ status: 'ok' });
  });

  it('/ready returns 503 when the database is down, without leaking details', async () => {
    const r = await app.inject('/ready');
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ status: 'unavailable' });
    expect(r.body).not.toMatch(/127\.0\.0\.1|ECONNREFUSED/);
  });

  it('sets security headers', async () => {
    const r = await app.inject('/health');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-frame-options']).toBe('DENY');
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('creates a request id and returns it', async () => {
    const r = await app.inject('/health');
    expect(r.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('keeps a sane caller request id, replaces a hostile one', async () => {
    expect((await app.inject({ url: '/health', headers: { 'x-request-id': 'trace-12345678' } })).headers['x-request-id']).toBe('trace-12345678');
    const bad = (await app.inject({ url: '/health', headers: { 'x-request-id': 'x\nfake log line' } })).headers['x-request-id'];
    expect(bad).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('unknown routes give the standard error shape', async () => {
    const r = await app.inject('/nope');
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ error: { code: 'not_found', message: 'Route not found', requestId: r.headers['x-request-id'] } });
  });

  it('oversized bodies are refused with 413 in the standard shape', async () => {
    const big = buildApp({ config: cfg, pool: dead });
    big.post('/echo', async req => req.body);
    const r = await big.inject({ method: 'POST', url: '/echo', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ a: 'x'.repeat(1_100_000) }) });
    expect(r.statusCode).toBe(413);
    expect(r.json().error.code).toBe('payload_too_large');
    await big.close();
  });

  it('malformed JSON gives 400, not a crash', async () => {
    const a = buildApp({ config: cfg, pool: dead });
    a.post('/echo', async req => req.body);
    const r = await a.inject({ method: 'POST', url: '/echo', headers: { 'content-type': 'application/json' }, payload: '{bad' });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('bad_request');
    await a.close();
  });

  it('unexpected errors become a generic 500 and are logged, not leaked', async () => {
    const a = buildApp({ config: cfg, pool: dead, logStream: stream });
    a.get('/boom', async () => { throw new Error('secret table name users_pii'); });
    const r = await a.inject('/boom');
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toContain('users_pii');
    expect(r.json().error).toMatchObject({ code: 'internal', message: 'Something went wrong' });
    expect(lines.join('')).toContain('users_pii'); // the operator still sees the cause
    await a.close();
  });

  it('logs do not contain credentials or query strings', async () => {
    lines.length = 0;
    await app.inject({ url: '/health?token=SECRETQUERY', headers: { authorization: 'Bearer SECRETBEARER', cookie: 'sid=SECRETCOOKIE' } });
    const out = lines.join('');
    expect(out).toContain('/health');
    for (const s of ['SECRETQUERY', 'SECRETBEARER', 'SECRETCOOKIE']) expect(out).not.toContain(s);
  });

  it('logs carry the request id', async () => {
    lines.length = 0;
    await app.inject({ url: '/health', headers: { 'x-request-id': 'trace-abcdef12' } });
    expect(lines.join('')).toContain('trace-abcdef12');
  });
});

describe.skipIf(!url)('against a real database', () => {
  const pool = new pg.Pool({ connectionString: url });
  const app = buildApp({ config: cfg, pool });
  afterAll(async () => { await app.close(); await pool.end(); });

  it('/ready is 200 when the database answers', async () => {
    const r = await app.inject('/ready');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ status: 'ready' });
  });
});

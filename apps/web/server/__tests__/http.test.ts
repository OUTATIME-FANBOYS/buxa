import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBodySchema } from '@buxa/contracts';
import { call, startRuntime } from './harness';
import { publicRoute } from '../http/route';
import { createTestIdentityProvider } from './tokens';

let env: ReturnType<typeof startRuntime> | undefined;
afterEach(async () => { await env?.stop(); env = undefined; vi.unstubAllEnvs(); });
const idp = await createTestIdentityProvider();

describe('request handling around every route', () => {
  it('/health answers without any configuration or database', async () => {
    vi.stubEnv('DATABASE_URL', ''); // the runtime could not even be built
    const r = await call('GET', '/health');
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ status: 'ok' }); expect(r.headers.get('cache-control')).toBe('no-store');
  });

  it('/ready is 503 when the database is down, without leaking details', async () => {
    env = startRuntime({ verifier: idp.verifier });
    const r = await call('GET', '/ready');
    expect(r.status).toBe(503); expect(await r.json()).toEqual({ status: 'unavailable' });
  });

  it('creates a request id and returns it; keeps a sane caller id; replaces a hostile one', async () => {
    env = startRuntime({ verifier: idp.verifier });
    expect((await call('GET', '/v1/me')).headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect((await call('GET', '/v1/me', { headers: { 'x-request-id': 'trace-12345678' } })).headers.get('x-request-id')).toBe('trace-12345678');
    expect((await call('GET', '/v1/me', { headers: { 'x-request-id': 'x" level=50 fake log line' } })).headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('401s carry a Bearer challenge, never say why, and are never cached', async () => {
    env = startRuntime({ verifier: idp.verifier });
    const r = await call('GET', '/v1/me', { token: await idp.token({ expiresIn: '-1h' }) });
    expect(r.status).toBe(401); expect(r.headers.get('www-authenticate')).toBe('Bearer');
    const body = await r.json(); ErrorBodySchema.parse(body);
    expect(body.error.message).toBe('Invalid or expired token');
    expect(JSON.stringify(body)).not.toMatch(/signature|issuer|audience|claim/i);
    expect(r.headers.get('cache-control')).toBe('no-store'); expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('ignores a token in the query string', async () => {
    env = startRuntime({ verifier: idp.verifier });
    expect((await call('GET', `/v1/me?access_token=${await idp.token()}`)).status).toBe(401);
  });

  it('refuses an oversized body with 413 in the standard shape', async () => {
    env = startRuntime({ verifier: idp.verifier });
    const r = await call('POST', '/v1/orgs', { token: await idp.token(), headers: { 'content-length': '2000000' }, rawBody: '{}' });
    expect(r.status).toBe(413); expect((await r.json()).error.code).toBe('payload_too_large');
  });

  it('answers 503 on protected routes when sign-in is not configured', async () => {
    env = startRuntime({ verifier: null });
    const r = await call('GET', '/v1/me', { token: 'anything' });
    expect(r.status).toBe(503); expect((await r.json()).error.message).toBe('Sign-in is not configured');
  });

  it('an unexpected error becomes a generic 500 and is logged with its cause', async () => {
    env = startRuntime({ verifier: idp.verifier });
    const boom = publicRoute(async () => { throw new Error('secret table users_pii'); });
    const r = await boom(new Request('http://localhost/boom'));
    expect(r.status).toBe(500); expect(await r.text()).not.toContain('users_pii');
    expect(env.logs.join('')).toContain('users_pii');
  });

  it('logs the request id and path, but never credentials or query strings', async () => {
    env = startRuntime({ verifier: idp.verifier });
    await call('GET', '/v1/me?token=SECRETQUERY', { headers: { authorization: 'Bearer SECRETBEARER', cookie: 'sid=SECRETCOOKIE', 'x-request-id': 'trace-abcdef12' } });
    const out = env.logs.join('');
    expect(out).toContain('trace-abcdef12'); expect(out).toContain('"/v1/me"');
    for (const s of ['SECRETQUERY', 'SECRETBEARER', 'SECRETCOOKIE']) expect(out).not.toContain(s);
  });

  it('a broken configuration is a generic 500 to the client and a clear message in the server log', async () => {
    vi.stubEnv('DATABASE_URL', 'mysql://user:hunter2@h/db');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await call('GET', '/v1/me');
    expect(r.status).toBe(500); expect(await r.text()).not.toMatch(/hunter2|DATABASE_URL/);
    expect(String(logged.mock.calls[0]?.[0])).toMatch(/Invalid configuration/);
    expect(String(logged.mock.calls[0]?.[0])).not.toContain('hunter2');
    logged.mockRestore();
  });
});

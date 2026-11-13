import { afterEach, describe, expect, it, vi } from 'vitest';
import { call, startRuntime } from './harness';

let env: ReturnType<typeof startRuntime> | undefined;
afterEach(async () => { await env?.stop(); env = undefined; vi.unstubAllGlobals(); });

const PRODUCTION = { NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://p.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' };
const supabaseSays = (settings: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(settings))));

describe('the email-confirmation start-up guard', () => {
  it('answers 503 on every route in production when Supabase auto-confirms sign-ups', async () => {
    supabaseSays({ mailer_autoconfirm: true });
    env = startRuntime({ env: PRODUCTION });
    for (const [method, path] of [['GET', '/v1/me'], ['GET', '/ready'], ['POST', '/v1/orgs']] as const) {
      const r = await call(method, path);
      expect(r.status, path).toBe(503); expect((await r.json()).error.message).toBe('Service unavailable');
    }
    expect(env.logs.join('')).toContain('auto-confirm');
  });

  it('serves normally in production when confirmation is required', async () => {
    supabaseSays({ mailer_autoconfirm: false });
    env = startRuntime({ env: PRODUCTION });
    expect((await call('GET', '/v1/me')).status).toBe(401); // live, and asking for a token
  });

  it('only warns when the check cannot run, so a Supabase outage cannot take the app down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    env = startRuntime({ env: PRODUCTION });
    expect((await call('GET', '/v1/me')).status).toBe(401);
    expect(env.logs.join('')).toContain('could not verify');
  });
});

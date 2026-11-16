import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const env = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
  return { store: undefined as unknown };
});

vi.mock('next/headers', () => ({ cookies: async () => env.store }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));

import MaintenancePage from '@/app/maintenance/page';
import { MAINTENANCE_MESSAGE } from '@/features/auth/lib/messages';
import { signIn, signUp } from '@/features/auth/actions';
import { idle } from '@/lib/actions/state';
import { MAINTENANCE_PATH, isRefusing } from '../availability';
import { installRuntime } from '../runtime';
import { requireSession } from '../session';
import { FakeCookieStore } from '../session/__tests__/support';
import { gotrue, stubIdentityProvider } from '../session/__tests__/gotrue';
import { startRuntime } from './harness';

// Production with Supabase set up: the start-up check reads Supabase's settings, so the test decides what it finds there.
const PRODUCTION = { NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key' };
const form = (fields: Record<string, string>): FormData => { const data = new FormData(); for (const [k, v] of Object.entries(fields)) data.set(k, v); return data; };

let runtime: ReturnType<typeof startRuntime> | undefined;
beforeEach(() => { env.store = new FakeCookieStore(); });
afterEach(async () => { await runtime?.stop(); runtime = undefined; installRuntime(undefined); vi.unstubAllGlobals(); });

/** Starts a production runtime whose start-up check sees `mailer_autoconfirm` as given. */
function startProduction(mailerAutoconfirm: boolean): void {
  stubIdentityProvider({ '/auth/v1/settings': { body: { mailer_autoconfirm: mailerAutoconfirm } } });
  runtime = startRuntime({ env: PRODUCTION });
}

describe('the start-up refusal reaches pages and server actions', () => {
  it('refuses: the session gate sends everyone to the maintenance page, not sign-in and not a 500', async () => {
    startProduction(true);
    await expect(requireSession()).rejects.toThrow(`REDIRECT ${MAINTENANCE_PATH}`);
    expect(runtime?.logs.join('')).toContain('auto-confirm');
  });

  it('allows: with confirmation required, the gate goes on to the normal sign-in redirect', async () => {
    startProduction(false);
    await expect(requireSession()).rejects.toThrow('REDIRECT /sign-in');
  });

  it('refuses: sign-up and sign-in answer with the maintenance message and call nothing at Supabase', async () => {
    startProduction(true);
    const calls = stubIdentityProvider({ '/auth/v1/signup': { body: gotrue.unconfirmedUser('x') }, '/auth/v1/token': { body: {} } });
    const fields = { name: 'Maya', email: 'maya@camp.test', password: 'long-enough-1' };
    expect(await signUp(idle, form(fields))).toEqual({ status: 'error', message: MAINTENANCE_MESSAGE });
    expect(await signIn(idle, form({ email: 'maya@camp.test', password: 'long-enough-1' }))).toEqual({ status: 'error', message: MAINTENANCE_MESSAGE });
    expect(calls.filter(c => c.path !== '/auth/v1/settings')).toHaveLength(0);
  });

  it('allows: with confirmation required, sign-up goes ahead', async () => {
    startProduction(false);
    stubIdentityProvider({ '/auth/v1/settings': { body: { mailer_autoconfirm: false } }, '/auth/v1/signup': { body: gotrue.unconfirmedUser('x') } });
    expect(await signUp(idle, form({ name: 'Maya', email: 'maya@camp.test', password: 'long-enough-1' }))).toMatchObject({ status: 'success' });
  });

  it('decides refusal only for the refuse decision', () => {
    expect(isRefusing('refuse')).toBe(true);
    expect(isRefusing('warn')).toBe(false);
    expect(isRefusing('ok')).toBe(false);
  });
});

describe('the maintenance page', () => {
  it('says what is happening and needs no session', () => {
    const html = renderToStaticMarkup(<MaintenancePage />);
    expect(html).toContain('down for maintenance');
    expect(html).not.toMatch(/sign in|sign-in/i);
  });
});

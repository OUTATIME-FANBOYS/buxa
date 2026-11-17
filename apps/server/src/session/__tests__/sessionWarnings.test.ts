import { afterEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

  return { store: undefined as unknown };
});

vi.mock('next/headers', () => ({ cookies: async () => env.store }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => {
  throw new Error(`REDIRECT ${url}`);
} }));
// The Supabase client itself fails on request: a real throwing cookie store would also fail in the client's background load.
const broken = vi.hoisted(() => ({ on: false }));
vi.mock('@buxa/server/session/supabaseClient', async importOriginal => {
  const actual = await importOriginal<typeof import('@buxa/server/session/supabaseClient')>();

  return {
    ...actual,
    createSessionClient: (store: Parameters<typeof actual.createSessionClient>[0]) => (broken.on
      ? { auth: { getSession: async () => {
        throw Object.assign(new Error(`cannot decode ${TOKEN} for ${EMAIL}`), { name: 'CookieDecodeError' });
      } } }
      : actual.createSessionClient(store)) as unknown as ReturnType<typeof actual.createSessionClient>,
  };
});

import { installRuntime } from '@buxa/server/runtime';
import { startRuntime } from '@buxa/server/__tests__/runtimeHarness';
import { createTestIdentityProvider } from '@buxa/server/__tests__/tokens';
import { getSession } from '@buxa/server/session/index';
import { InMemoryStore } from '@buxa/server/__tests__/fakes';
import { FakeCookieStore, SESSION_COOKIE, sessionCookieValue } from '@buxa/server/session/__tests__/support';

const EMAIL = 'maya.camp@example.test';
const TOKEN = 'eyJhbGciOiJFUzI1NiJ9.secret-payload';
let runtime: ReturnType<typeof startRuntime> | undefined;

afterEach(async () => {
  await runtime?.stop(); runtime = undefined; installRuntime(undefined); vi.unstubAllEnvs();
});

describe('the session reader warns when it cannot read the session (audit S-20)', () => {
  it('a failing cookie read still means signed out, and logs the error name only', async () => {
    const idp = await createTestIdentityProvider();
    runtime = startRuntime({ verifier: idp.verifier, repositories: new InMemoryStore().asRepositories() });
    // The client fails with an error whose message carries a token and an address. Neither may reach the log.
    broken.on = true;
    env.store = new FakeCookieStore({ [SESSION_COOKIE]: sessionCookieValue(TOKEN) });
    expect(await getSession()).toBeNull();
    broken.on = false;
    const text = runtime.logs.join('\n');
    expect(text).toContain('"level":40');
    expect(text).toContain('CookieDecodeError');
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(EMAIL);
  });

  it('a valid session is still read with no warning', async () => {
    const idp = await createTestIdentityProvider();
    runtime = startRuntime({ verifier: idp.verifier, repositories: new InMemoryStore().asRepositories() });
    const token = await idp.token({ sub: crypto.randomUUID() });
    env.store = new FakeCookieStore({ [SESSION_COOKIE]: sessionCookieValue(token) });
    expect(await getSession()).not.toBeNull();
    expect(runtime.logs.join('\n')).not.toContain('"level":40');
  });
});

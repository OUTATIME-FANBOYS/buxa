import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
  return { store: undefined as unknown };
});

vi.mock('next/headers', () => ({ cookies: async () => env.store }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));

import { ROUTES } from '@/config';
import { idle } from '@/lib/actions/state';
import { InMemoryStore } from '@/server/__tests__/fakes';
import { startRuntime } from '@/server/__tests__/harness';
import { createTestIdentityProvider } from '@/server/__tests__/tokens';
import { CAMP_COOKIE, getSession } from '@/server/session';
import { gotrue, stubIdentityProvider } from '@/server/session/__tests__/gotrue';
import { FakeCookieStore, SESSION_COOKIE, personWithCamps, sessionCookieValue } from '@/server/session/__tests__/support';
import { signIn, signOut, signUp } from '.';

const form = (fields: Record<string, string>): FormData => { const data = new FormData(); for (const [k, v] of Object.entries(fields)) data.set(k, v); return data; };
const sub = crypto.randomUUID();
let store: FakeCookieStore;
let runtime: ReturnType<typeof startRuntime>;
let idp: Awaited<ReturnType<typeof createTestIdentityProvider>>;
let data: InMemoryStore;

beforeEach(async () => {
  idp = await createTestIdentityProvider();
  data = new InMemoryStore();
  runtime = startRuntime({ verifier: idp.verifier, repositories: data.asRepositories() });
  store = new FakeCookieStore(); env.store = store;
});
afterEach(async () => { await runtime.stop(); vi.unstubAllGlobals(); });

describe('signIn', () => {
  it('refuses empty fields without calling the identity provider', async () => {
    const calls = stubIdentityProvider({});
    const result = await signIn(idle, form({ email: 'nope', password: '' }));
    expect(result).toMatchObject({ status: 'error', fieldErrors: { email: 'Enter a valid email address.', password: 'Enter your password.' } });
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['invalid_credentials', 'Invalid login credentials', 'That email and password do not match.'],
    ['email_not_confirmed', 'Email not confirmed', 'Confirm your email first. Check your inbox for the link.'],
    ['over_request_rate_limit', 'Request rate limit reached', 'Too many attempts. Wait a minute and try again.'],
    ['unexpected_failure', 'something odd', 'Could not sign in. Please try again.'],
  ])('maps the provider error %s to a friendly message', async (code, raw, shown) => {
    stubIdentityProvider({ '/auth/v1/token': gotrue.error(400, code, raw) });
    expect(await signIn(idle, form({ email: 'a@camp.test', password: 'secret-pass' }))).toEqual({ status: 'error', message: shown, fieldErrors: undefined });
    expect(store.writes).toHaveLength(0);
  });

  it('signs in: every cookie it sets is HttpOnly, and the session it makes verifies', async () => {
    await personWithCamps(data, sub, ['Pine Lake']);
    const access = await idp.token({ sub });
    stubIdentityProvider({ '/auth/v1/token': { body: gotrue.session(access, sub) } });
    await expect(signIn(idle, form({ email: 'a@camp.test', password: 'secret-pass' }))).rejects.toThrow(`REDIRECT ${ROUTES.camp}`);

    expect(store.writes.length).toBeGreaterThan(0);
    for (const write of store.writes) expect(write.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    expect(store.get(SESSION_COOKIE)).toBeDefined();
    expect((await getSession())?.memberships.map(m => m.name)).toEqual(['Pine Lake']);
  });
});

describe('signUp', () => {
  const fields = { name: 'Maya', email: 'maya@camp.test', password: 'long-enough-1' };

  it('checks each field', async () => {
    const result = await signUp(idle, form({ name: ' ', email: 'x', password: 'short' }));
    expect(result).toMatchObject({ status: 'error', fieldErrors: { name: 'Tell us what to call you.', email: 'Enter a valid email address.', password: 'Use at least 8 characters.' } });
  });

  it('asks the person to confirm their email when no session comes back', async () => {
    stubIdentityProvider({ '/auth/v1/signup': { body: gotrue.unconfirmedUser(sub) } });
    expect(await signUp(idle, form(fields))).toEqual({ status: 'success', message: 'Check your email for a confirmation link, then sign in.' });
    for (const write of store.writes) expect(write.options).toMatchObject({ httpOnly: true }); // e.g. the sign-up verifier cookie
    expect(store.get(SESSION_COOKIE)).toBeUndefined();
    expect(await getSession()).toBeNull();
  });

  it('signs in straight away when the provider returns a session', async () => {
    stubIdentityProvider({ '/auth/v1/signup': { body: gotrue.session(await idp.token({ sub }), sub) } });
    await expect(signUp(idle, form(fields))).rejects.toThrow(`REDIRECT ${ROUTES.camp}`);
    for (const write of store.writes) expect(write.options).toMatchObject({ httpOnly: true });
  });

  it('gives a new and an already-registered address the same answer, and never says an account exists', async () => {
    stubIdentityProvider({ '/auth/v1/signup': { body: gotrue.unconfirmedUser(sub) } });
    const fresh = await signUp(idle, form(fields));
    stubIdentityProvider({ '/auth/v1/signup': { body: gotrue.unconfirmedUser(sub) } }); // GoTrue answers an existing address the same way
    expect(await signUp(idle, form(fields))).toEqual(fresh);

    stubIdentityProvider({ '/auth/v1/signup': gotrue.error(422, 'user_already_exists', 'User already registered') });
    const refused = await signUp(idle, form(fields));
    expect(refused).toMatchObject({ status: 'error', message: 'Could not create the account. Please try again.' });
    expect(JSON.stringify(refused)).not.toMatch(/already|registered|exists/i);
  });

  it('maps a weak-password error', async () => {
    stubIdentityProvider({ '/auth/v1/signup': gotrue.error(422, 'weak_password', 'Password should be at least 8 characters') });
    expect(await signUp(idle, form(fields))).toMatchObject({ status: 'error', message: 'Choose a stronger password (at least 8 characters).' });
  });
});

describe('signOut', () => {
  it('clears the session cookies (HttpOnly), forgets the camp and goes to sign-in', async () => {
    store = new FakeCookieStore({ [SESSION_COOKIE]: sessionCookieValue(await idp.token({ sub })), [CAMP_COOKIE]: 'org-1' });
    env.store = store;
    stubIdentityProvider({ '/auth/v1/logout': { status: 204 } });
    await expect(signOut()).rejects.toThrow(`REDIRECT ${ROUTES.signIn}`);
    expect(store.deleted).toContain(CAMP_COOKIE);
    expect(store.get(SESSION_COOKIE)?.value ?? '').toBe('');
    for (const write of store.writes) expect(write.options).toMatchObject({ httpOnly: true, maxAge: 0 });
    expect(await getSession()).toBeNull();
  });
});

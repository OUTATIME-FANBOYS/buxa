import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
  return { store: undefined as unknown };
});

vi.mock('next/headers', () => ({ cookies: async () => env.store }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));

import { ROUTES } from '@/config';
import { installRuntime } from '../../runtime';
import { InMemoryStore } from '../../__tests__/fakes';
import { ISSUER, createTestIdentityProvider } from '../../__tests__/tokens';
import { startRuntime } from '../../__tests__/harness';
import { CAMP_COOKIE, getCurrentCamp, getSession, rememberCamp, requireSession, toActor } from '..';
import { FakeCookieStore, SESSION_COOKIE, personWithCamps, sessionCookieValue, tampered, unsignedToken } from './support';

let idp: Awaited<ReturnType<typeof createTestIdentityProvider>>;
let data: InMemoryStore;
let runtime: ReturnType<typeof startRuntime>;
const sub = crypto.randomUUID();

const signedInWith = (token: string, extra: Record<string, string> = {}) => { env.store = new FakeCookieStore({ [SESSION_COOKIE]: sessionCookieValue(token), ...extra }); };

beforeEach(async () => {
  idp = await createTestIdentityProvider();
  data = new InMemoryStore();
  runtime = startRuntime({ verifier: idp.verifier, repositories: data.asRepositories() });
  env.store = new FakeCookieStore();
});
afterEach(async () => { await runtime.stop(); installRuntime(undefined); vi.unstubAllEnvs(); });

describe('getSession', () => {
  it('accepts a valid session cookie and loads the user and their camps', async () => {
    await personWithCamps(data, sub, ['Pine Lake']);
    signedInWith(await idp.token({ sub }));
    const session = await getSession();
    expect(session?.user.email).toBe(`${sub.slice(0, 8)}@camp.test`);
    expect(session?.memberships.map(m => m.name)).toEqual(['Pine Lake']);
  });

  it('is null without a cookie', async () => { expect(await getSession()).toBeNull(); });
  it('is null when the cookie is not a session at all', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // the Supabase library warns about the unreadable cookie
    env.store = new FakeCookieStore({ [SESSION_COOKIE]: 'base64-%%%not-json' });
    expect(await getSession()).toBeNull();
  });
  it('is null when sign-in is not configured', async () => {
    await runtime.stop();
    runtime = startRuntime({ verifier: null, repositories: data.asRepositories() });
    signedInWith(await idp.token({ sub }));
    expect(await getSession()).toBeNull();
  });

  it.each([
    ['expired', (i: typeof idp) => i.token({ sub, expiresIn: '-1h' })],
    ['issued by another issuer', (i: typeof idp) => i.token({ sub, issuer: 'https://evil.example/auth/v1' })],
    ['meant for another audience', (i: typeof idp) => i.token({ sub, audience: 'someone-else' })],
    ['signed with a stranger\'s key', (i: typeof idp) => i.token({ sub, signWith: i.strangerKey })],
    ['unsigned (alg none)', async () => unsignedToken(sub, ISSUER)],
    ['tampered after signing', async (i: typeof idp) => tampered(await i.token({ sub }))],
  ])('refuses a token that is %s', async (_label, make) => {
    await personWithCamps(data, sub, ['Pine Lake']);
    signedInWith(await make(idp));
    expect(await getSession()).toBeNull();
  });
});

describe('requireSession', () => {
  it('sends a signed-out visitor to the sign-in page', async () => {
    await expect(requireSession()).rejects.toThrow(`REDIRECT ${ROUTES.signIn}`);
  });
  it('sends a visitor with a forged cookie to the sign-in page', async () => {
    signedInWith(unsignedToken(sub, ISSUER));
    await expect(requireSession()).rejects.toThrow(`REDIRECT ${ROUTES.signIn}`);
  });
  it('returns the session for a signed-in visitor', async () => {
    signedInWith(await idp.token({ sub }));
    expect((await requireSession()).user.id).toBeTruthy();
  });
});

describe('getCurrentCamp', () => {
  it('uses the selected camp when the person belongs to it', async () => {
    const { memberships } = await personWithCamps(data, sub, ['First', 'Second']);
    env.store = new FakeCookieStore({ [CAMP_COOKIE]: memberships[1].orgId });
    const session = { user: { id: 'u', email: 'a@b.c', name: 'A' }, memberships };
    expect((await getCurrentCamp(session))?.name).toBe('Second');
  });

  it('ignores a camp cookie that names a camp the person does not belong to', async () => {
    const mine = await personWithCamps(data, sub, ['Mine']);
    const theirs = await personWithCamps(data, crypto.randomUUID(), ['Theirs']);
    env.store = new FakeCookieStore({ [CAMP_COOKIE]: theirs.memberships[0].orgId });
    const camp = await getCurrentCamp({ user: { id: 'u', email: 'a@b.c', name: 'A' }, memberships: mine.memberships });
    expect(camp?.name).toBe('Mine');
  });

  it('falls back to the first camp when the cookie is junk or missing', async () => {
    const { memberships } = await personWithCamps(data, sub, ['First', 'Second']);
    const session = { user: { id: 'u', email: 'a@b.c', name: 'A' }, memberships };
    env.store = new FakeCookieStore({ [CAMP_COOKIE]: 'not-a-camp' });
    expect((await getCurrentCamp(session))?.name).toBe('First');
    env.store = new FakeCookieStore();
    expect((await getCurrentCamp(session))?.name).toBe('First');
  });

  it('is null when the person has no camp yet', async () => {
    env.store = new FakeCookieStore({ [CAMP_COOKIE]: crypto.randomUUID() });
    expect(await getCurrentCamp({ user: { id: 'u', email: 'a@b.c', name: 'A' }, memberships: [] })).toBeNull();
  });
});

describe('rememberCamp', () => {
  it('writes an HttpOnly, SameSite=Lax cookie for the whole site', async () => {
    const store = new FakeCookieStore(); env.store = store;
    await rememberCamp('org-1');
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0]).toMatchObject({ name: CAMP_COOKIE, value: 'org-1', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false } });
  });

  it('is Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const store = new FakeCookieStore(); env.store = store;
    await rememberCamp('org-1');
    expect(store.writes[0].options.secure).toBe(true);
  });
});

describe('toActor', () => {
  it('describes the person in the chosen camp', () => {
    const camp = { orgId: 'o', role: 'admin' as const, name: 'N', slug: 's' };
    expect(toActor({ user: { id: 'u', email: 'a@b.c', name: 'A' }, memberships: [camp] }, camp)).toEqual({ userId: 'u', orgId: 'o', role: 'admin' });
  });
});

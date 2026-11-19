import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Kept: the compiler needs this assertion to type the value; removing it fails typecheck.
  return { store: undefined as unknown };
});

vi.mock('next/headers', () => ({ cookies: () => settle(() => env.store) }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { ROUTES } from '@buxa/shared/config/routes';
import { installRuntime } from '@buxa/server/runtime';
import { InMemoryStore } from '@buxa/server/__tests__/fakes';
import { ISSUER, createTestIdentityProvider } from '@buxa/server/__tests__/tokens';
import { startRuntime } from '@buxa/server/__tests__/runtimeHarness';
import {
  CAMP_COOKIE,
  getCurrentCamp,
  getSession,
  rememberCamp,
  requireSession,
  toActor,
} from '@buxa/server/session/index';
import {
  FakeCookieStore,
  SESSION_COOKIE,
  personWithCamps,
  sessionCookieValue,
  tampered,
  unsignedToken,
} from '@buxa/server/session/__tests__/support';
import { settle } from '@buxa/domain';

let idp: Awaited<ReturnType<typeof createTestIdentityProvider>>;
let data: InMemoryStore;
let runtime: ReturnType<typeof startRuntime>;
const sub = crypto.randomUUID();

const signedInWith = (token: string, extra: Record<string, string> = {}) => {
  env.store = new FakeCookieStore({ [SESSION_COOKIE]: sessionCookieValue(token), ...extra });
};

beforeEach(async () => {
  idp = await createTestIdentityProvider();
  data = new InMemoryStore();
  runtime = startRuntime({ verifier: idp.verifier, repositories: data.asRepositories() });
  env.store = new FakeCookieStore();
});
afterEach(async () => {
  await runtime.stop();
  installRuntime(undefined);
  vi.unstubAllEnvs();
});

describe('getSession', () => {
  it('accepts a valid session cookie and loads the user and their camps', async () => {
    await personWithCamps(data, sub, ['Pine Lake']);
    signedInWith(await idp.token({ sub }));
    const session = await getSession();
    expect(session?.user.email).toBe(`${sub.slice(0, 8)}@camp.test`);
    expect(session?.memberships.map(m => m.name)).toEqual(['Pine Lake']);
  });

  it('is null without a cookie', async () => {
    expect(await getSession()).toBeNull();
  });
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
    ["signed with a stranger's key", (i: typeof idp) => i.token({ sub, signWith: i.strangerKey })],
    ['unsigned (alg none)', () => settle(() => unsignedToken(sub, ISSUER))],
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
    const session = {
      user: { id: 'u', email: 'a@b.c', name: 'A', firstName: 'A', lastName: null, clockFormat: null },
      memberships,
    };
    expect((await getCurrentCamp(session))?.name).toBe('Second');
  });

  it('ignores a camp cookie that names a camp the person does not belong to', async () => {
    const mine = await personWithCamps(data, sub, ['Mine']);
    const theirs = await personWithCamps(data, crypto.randomUUID(), ['Theirs']);
    env.store = new FakeCookieStore({ [CAMP_COOKIE]: theirs.memberships[0].orgId });
    const camp = await getCurrentCamp({
      user: { id: 'u', email: 'a@b.c', name: 'A', firstName: 'A', lastName: null, clockFormat: null },
      memberships: mine.memberships,
    });
    expect(camp?.name).toBe('Mine');
  });

  it('opens an archived camp read-only when the cookie selects it, and never as the default', async () => {
    const { memberships } = await personWithCamps(data, sub, ['Active']);
    const archived = { orgId: crypto.randomUUID(), role: 'staff' as const, name: 'Old Camp', slug: 'old-camp' };
    const session = {
      user: { id: 'u', email: 'a@b.c', name: 'A', firstName: 'A', lastName: null, clockFormat: null },
      memberships,
      archivedMemberships: [archived],
    };

    env.store = new FakeCookieStore({ [CAMP_COOKIE]: archived.orgId });
    expect(await getCurrentCamp(session)).toEqual({ ...archived, archived: true });

    env.store = new FakeCookieStore();
    expect((await getCurrentCamp(session))?.name).toBe('Active');

    const onlyArchived = { user: session.user, memberships: [], archivedMemberships: [archived] };
    env.store = new FakeCookieStore();
    expect(await getCurrentCamp(onlyArchived)).toBeNull();
  });

  it('falls back to the first camp when the cookie is junk or missing', async () => {
    const { memberships } = await personWithCamps(data, sub, ['First', 'Second']);
    const session = {
      user: { id: 'u', email: 'a@b.c', name: 'A', firstName: 'A', lastName: null, clockFormat: null },
      memberships,
    };
    env.store = new FakeCookieStore({ [CAMP_COOKIE]: 'not-a-camp' });
    expect((await getCurrentCamp(session))?.name).toBe('First');
    env.store = new FakeCookieStore();
    expect((await getCurrentCamp(session))?.name).toBe('First');
  });

  it('is null when the person has no camp yet', async () => {
    env.store = new FakeCookieStore({ [CAMP_COOKIE]: crypto.randomUUID() });
    expect(
      await getCurrentCamp({
        user: { id: 'u', email: 'a@b.c', name: 'A', firstName: 'A', lastName: null, clockFormat: null },
        memberships: [],
      }),
    ).toBeNull();
  });
});

describe('rememberCamp', () => {
  it('writes an HttpOnly, SameSite=Lax cookie for the whole site', async () => {
    const store = new FakeCookieStore();
    env.store = store;
    await rememberCamp('org-1');
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0]).toMatchObject({
      name: CAMP_COOKIE,
      value: 'org-1',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
    });
  });

  it('is Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const store = new FakeCookieStore();
    env.store = store;
    await rememberCamp('org-1');
    expect(store.writes[0].options.secure).toBe(true);
  });
});

describe('toActor', () => {
  it('describes the person in the chosen camp', () => {
    const camp = { orgId: 'o', role: 'admin' as const, name: 'N', slug: 's', archived: false };
    expect(
      toActor(
        {
          user: { id: 'u', email: 'a@b.c', name: 'A', firstName: 'A', lastName: null, clockFormat: null },
          memberships: [camp],
        },
        camp,
      ),
    ).toEqual({
      userId: 'u',
      orgId: 'o',
      role: 'admin',
      archived: false,
    });
  });

  it('marks the actor of an archived camp, so every write is refused', () => {
    const camp = { orgId: 'o', role: 'owner' as const, name: 'N', slug: 's', archived: true };
    expect(
      toActor(
        {
          user: { id: 'u', email: 'a@b.c', name: 'A', firstName: 'A', lastName: null, clockFormat: null },
          memberships: [],
        },
        camp,
      ).archived,
    ).toBe(true);
  });
});

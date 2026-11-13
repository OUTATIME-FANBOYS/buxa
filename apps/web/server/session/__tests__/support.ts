import type { Membership } from '@buxa/contracts';
import { InMemoryStore } from '../../__tests__/fakes';

/** A Supabase address that nothing listens on: a stray network call fails at once instead of hanging. */
export const TEST_SUPABASE_URL = 'http://127.0.0.1:1';
export const TEST_PUBLISHABLE_KEY = 'test-publishable-key';
/** What the Supabase library names the session cookie for the address above (`sb-<first label of the host>-auth-token`). */
export const SESSION_COOKIE = 'sb-127-auth-token';

const base64url = (text: string): string => Buffer.from(text).toString('base64url');

/** The cookie value the Supabase library writes for a session: `base64-` plus the base64url of the session JSON. */
export function sessionCookieValue(accessToken: string, expiresAt = Math.floor(Date.now() / 1000) + 3600): string {
  const session = { access_token: accessToken, refresh_token: 'refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user: { id: 'u', aud: 'authenticated' } };
  return `base64-${base64url(JSON.stringify(session))}`;
}

export interface CookieWrite { name: string; value: string; options: Record<string, unknown> }

/** An in-memory stand-in for the `cookies()` store of `next/headers`, remembering every write so tests can inspect the attributes. */
export class FakeCookieStore {
  readonly writes: CookieWrite[] = [];
  readonly deleted: string[] = [];
  private readonly jar = new Map<string, string>();
  constructor(initial: Record<string, string> = {}) { for (const [name, value] of Object.entries(initial)) this.jar.set(name, value); }
  getAll(): { name: string; value: string }[] { return [...this.jar].map(([name, value]) => ({ name, value })); }
  get(name: string): { name: string; value: string } | undefined { const value = this.jar.get(name); return value === undefined ? undefined : { name, value }; }
  set(name: string, value: string, options: Record<string, unknown> = {}): void { this.jar.set(name, value); this.writes.push({ name, value, options }); }
  delete(name: string): void { this.jar.delete(name); this.deleted.push(name); }
}

/** A person with an account and camps, made through the in-memory repositories. */
export async function personWithCamps(store: InMemoryStore, sub: string, camps: string[]): Promise<{ memberships: Membership[] }> {
  const user = await store.upsertFromIdentity({ authId: sub, email: `${sub.slice(0, 8)}@camp.test`, name: 'Test Person' });
  for (const name of camps) await store.createWithOwner({ name, slug: `${name.toLowerCase().replace(/\W+/g, '-')}-${sub.slice(0, 6)}` }, user.id);
  return { memberships: await store.membershipsOf(user.id) };
}

/** A token whose header says `alg: none` and which carries no signature at all. */
export function unsignedToken(sub: string, issuer: string): string {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ sub, email: `${sub.slice(0, 8)}@camp.test`, iss: issuer, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `${header}.${payload}.`;
}

/** The same token with one character in the middle of its signature changed (the last character holds padding bits, so it is avoided). */
export function tampered(token: string): string {
  const at = token.length - 10;
  return `${token.slice(0, at)}${token[at] === 'A' ? 'B' : 'A'}${token.slice(at + 1)}`;
}

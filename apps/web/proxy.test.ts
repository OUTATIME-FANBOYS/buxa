import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
});

import { NextRequest } from 'next/server';
import { SECURITY_HEADERS } from '@/config';
import { createTestIdentityProvider } from '@/server/__tests__/tokens';
import { gotrue, stubIdentityProvider } from '@/server/session/__tests__/gotrue';
import { SESSION_COOKIE, sessionCookieValue } from '@/server/session/__tests__/support';
import { refreshSessionCookies } from '@/server/session/refresh';
import { proxy } from './proxy';

const request = (cookie?: string) => new NextRequest('http://localhost/camp', { headers: cookie ? { cookie } : {} });
afterEach(() => vi.unstubAllGlobals());

describe('proxy', () => {
  it('still sets the nonce policy and every security header', async () => {
    const response = await proxy(request());
    const policy = response.headers.get('content-security-policy') ?? '';
    expect(policy).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self'");
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(response.headers.get(name)).toBe(value);
  });

  it('gives every request its own nonce', async () => {
    const [a, b] = [await proxy(request()), await proxy(request())];
    expect(a.headers.get('content-security-policy')).not.toBe(b.headers.get('content-security-policy'));
  });

  it('does not contact the identity provider for a signed-out visitor', async () => {
    const calls = stubIdentityProvider({});
    const response = await proxy(request());
    expect(calls).toHaveLength(0);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('renews an expiring session: the new cookie is HttpOnly, uncacheable, and the policy is untouched', async () => {
    const idp = await createTestIdentityProvider();
    const sub = crypto.randomUUID();
    const old = await idp.token({ sub });
    const fresh = await idp.token({ sub });
    const calls = stubIdentityProvider({ '/auth/v1/token': { body: gotrue.session(fresh, sub) } });
    const stale = sessionCookieValue(old, Math.floor(Date.now() / 1000) - 60);

    const response = await proxy(request(`${SESSION_COOKIE}=${stale}`));
    expect(calls.map(c => c.path)).toEqual(['/auth/v1/token']);
    const cookies = response.headers.getSetCookie().filter(line => line.startsWith(`${SESSION_COOKIE}=`));
    expect(cookies.length).toBeGreaterThan(0);
    for (const line of cookies) expect(line).toMatch(/HttpOnly/i);
    for (const line of cookies) expect(line).toMatch(/SameSite=lax/i);
    expect(response.headers.get('cache-control')).toMatch(/no-store/);
    expect(response.headers.get('content-security-policy')).toMatch(/nonce-/);
  });

  it('does not make a page wait for an identity provider that is down', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); }); // the library retries this for a long time
    const stale = sessionCookieValue('x.y.z', Math.floor(Date.now() / 1000) - 60);
    const started = Date.now();
    expect(await refreshSessionCookies(request(`${SESSION_COOKIE}=${stale}`), 50)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

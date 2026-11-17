import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const outcome = vi.hoisted(() => ({ next: async (): Promise<unknown> => ({ data: { session: null }, error: null }) }));
vi.mock('../supabaseClient', () => ({
  createSessionClient: () => ({ auth: { getSession: () => outcome.next() } }),
}));

import { createLogger } from '../../log';
import { refreshSessionCookies } from '../refresh';

const EMAIL = 'maya.camp@example.test';
const TOKEN = 'eyJhbGciOiJFUzI1NiJ9.secret-payload';
const request = { cookies: { getAll: () => [{ name: 'sb-127-auth-token', value: `base64-${TOKEN}` }] } } as unknown as NextRequest;

let lines: string[];
beforeEach(() => { lines = []; });
const log = () => createLogger('warn', line => lines.push(line));

describe('the refresh path warns when the identity provider fails (audit S-20)', () => {
  it('an error returned by the client is logged by name, and the page is still served', async () => {
    outcome.next = async () => ({ data: { session: null }, error: Object.assign(new Error(`refresh failed for ${EMAIL} ${TOKEN}`), { name: 'AuthRetryableFetchError' }) });
    expect(await refreshSessionCookies(request, 1000, log())).toBeNull();
    const text = lines.join('\n');
    expect(text).toContain('AuthRetryableFetchError');
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain(TOKEN);
  });

  it('a thrown error is logged by name only, and the page is still served', async () => {
    outcome.next = async () => { throw Object.assign(new TypeError(`fetch failed ${EMAIL} ${TOKEN}`), {}); };
    expect(await refreshSessionCookies(request, 1000, log())).toBeNull();
    const text = lines.join('\n');
    expect(text).toContain('"reason":"TypeError"');
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain(TOKEN);
  });

  it('a healthy refresh writes nothing to the log', async () => {
    outcome.next = async () => ({ data: { session: null }, error: null });
    await refreshSessionCookies(request, 1000, log());
    expect(lines).toEqual([]);
  });
});

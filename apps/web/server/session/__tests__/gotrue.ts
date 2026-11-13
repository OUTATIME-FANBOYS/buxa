import { vi } from 'vitest';
import { TEST_SUPABASE_URL } from './support';

/** What the identity provider (GoTrue) answers. Only the shapes the Supabase library reads. */
export const gotrue = {
  session: (accessToken: string, sub: string) => ({
    access_token: accessToken, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-token-2',
    user: { id: sub, aud: 'authenticated', role: 'authenticated', email: `${sub.slice(0, 8)}@camp.test`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  }),
  unconfirmedUser: (sub: string) => ({ id: sub, aud: 'authenticated', role: '', email: `${sub.slice(0, 8)}@camp.test`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }),
  error: (status: number, errorCode: string, message: string) => ({ status, body: { code: status, error_code: errorCode, msg: message } }),
};

export interface Reply { status?: number; body?: unknown }
export interface Call { method: string; path: string }

/** Replaces `fetch` with a fake identity provider that answers by path, and records what was asked. No network is touched. */
export function stubIdentityProvider(replies: Record<string, Reply>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const call = { method: init?.method ?? 'GET', path: url.pathname };
    calls.push(call);
    if (url.origin !== TEST_SUPABASE_URL) throw new Error(`unexpected request to ${url.origin}`);
    const reply = replies[url.pathname];
    if (!reply) throw new Error(`unexpected request ${call.method} ${call.path}`);
    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body ?? {}), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
  });
  return calls;
}

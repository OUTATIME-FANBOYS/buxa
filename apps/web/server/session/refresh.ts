import type { NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';
import { createSessionClient } from './supabaseClient';

export interface CookieWrite { name: string; value: string; options: CookieOptions }
export interface Refreshed { cookies: CookieWrite[]; headers: Record<string, string> }

/**
 * Renews the session cookies when the access token is close to expiring (a Server Component cannot write cookies, so this runs in
 * `proxy.ts` for every request). Returns what must be written to the response, or null when there is nothing to change.
 * It does not decide who is signed in: that is `getSession`, which verifies the token itself.
 * Cookies come back already hardened (HttpOnly, SameSite=Lax, Secure in production).
 */
export async function refreshSessionCookies(request: NextRequest): Promise<Refreshed | null> {
  if (!request.cookies.getAll().some(cookie => cookie.name.startsWith('sb-'))) return null; // signed-out visitors cost nothing
  const result: Refreshed = { cookies: [], headers: {} };
  const client = createSessionClient({
    getAll: () => request.cookies.getAll(),
    setAll(cookies, headers) { result.cookies.push(...cookies); Object.assign(result.headers, headers); },
  });
  if (!client) return null;
  try { await client.auth.getSession(); } catch { return null; }
  return result.cookies.length > 0 ? result : null;
}

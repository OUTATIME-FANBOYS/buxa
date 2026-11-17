import type { NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';
import { errorName, createLogger, type Logger } from '../log';
import { createSessionClient } from './supabaseClient';

/** The proxy runs without the app's configuration, so it logs warnings to stdout directly. */
const proxyLog = createLogger('warn');

export interface CookieWrite { name: string; value: string; options: CookieOptions }
const REFRESH_TIMEOUT_MS = 2500;

export interface Refreshed { cookies: CookieWrite[]; headers: Record<string, string> }

/**
 * Renews the session cookies when the access token is close to expiring (a Server Component cannot write cookies, so this runs in
 * `proxy.ts` for every request). Returns what must be written to the response, or null when there is nothing to change.
 * It does not decide who is signed in: that is `getSession`, which verifies the token itself.
 * Cookies come back already hardened (HttpOnly, SameSite=Lax, Secure in production).
 * If the identity provider is slow or down the page is served anyway after `timeoutMs`: the library retries network errors for
 * a long time, and no page should wait for that.
 */
export async function refreshSessionCookies(request: NextRequest, timeoutMs = REFRESH_TIMEOUT_MS, log: Logger = proxyLog): Promise<Refreshed | null> {
  if (!request.cookies.getAll().some(cookie => cookie.name.startsWith('sb-'))) {
    return null;
  } // signed-out visitors cost nothing
  const result: Refreshed = { cookies: [], headers: {} };
  const client = createSessionClient({
    getAll: () => request.cookies.getAll(),
    setAll(cookies, headers) {
      result.cookies.push(...cookies); Object.assign(result.headers, headers);
    },
  });
  if (!client) {
    return null;
  }
  const gaveUp = new Promise<null>(resolve => {
    setTimeout(() => resolve(null), timeoutMs).unref?.();
  });
  try {
    const outcome = await Promise.race([client.auth.getSession(), gaveUp]);
    // A failed refresh still serves the page (signed out, if the token has expired). Logged by name only, so an outage is visible (audit S-20).
    if (outcome?.error) {
      log.warn({ reason: outcome.error.name }, 'could not refresh the session; serving the page as it is');
    }
  } catch (error) {
    log.warn({ reason: errorName(error) }, 'could not refresh the session; serving the page as it is');

    return null;
  }

  return result.cookies.length > 0 ? result : null;
}

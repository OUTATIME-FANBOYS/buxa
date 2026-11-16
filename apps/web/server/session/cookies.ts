import type { CookieOptions } from '@supabase/ssr';

/**
 * The attributes every cookie we set carries, defined once. HttpOnly keeps script from reading it, SameSite=Lax keeps it off
 * cross-site POSTs, and Secure keeps it off plain HTTP in production. The library's own default is NOT HttpOnly, so we force it.
 */
export function hardenCookie(options: CookieOptions = {}): CookieOptions {
  return { ...options, httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' };
}

/** Applies `hardenCookie` to a list the Supabase client asks us to write (new tokens, or removal on sign-out). */
export const hardenAll = <T extends { options: CookieOptions }>(cookies: readonly T[]): T[] =>
  cookies.map(cookie => ({ ...cookie, options: hardenCookie(cookie.options) }));

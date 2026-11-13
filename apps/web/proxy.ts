import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/config/env';
import { SECURITY_HEADERS, buildContentSecurityPolicy } from '@/config/security';
import { refreshSessionCookies } from '@/server/session/refresh';

/**
 * Runs before every page and API request: gives it a fresh nonce for the Content-Security-Policy, adds the security headers,
 * and renews the session cookies when they are about to expire.
 * (Next.js 16 calls this file `proxy`; it was `middleware` before.)
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = btoa(crypto.randomUUID());
  const policy = buildContentSecurityPolicy({ nonce, dev: process.env.NODE_ENV !== 'production', supabaseUrl: publicEnv.supabaseUrl });

  // New tokens go on the request too, so the page being rendered sees them, and on the response, so the browser keeps them.
  const refreshed = await refreshSessionCookies(request);
  for (const { name, value } of refreshed?.cookies ?? []) request.cookies.set(name, value);

  // The policy goes on the request too, so Next.js can find the nonce and stamp it on the scripts it renders.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', policy);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', policy);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  for (const { name, value, options } of refreshed?.cookies ?? []) response.cookies.set(name, value, options);
  for (const [name, value] of Object.entries(refreshed?.headers ?? {})) response.headers.set(name, value);
  return response;
}

export const config = {
  // Everything except Next.js's own static files and images.
  matcher: ['/((?!_next/static|_next/image|icon.svg).*)'],
};

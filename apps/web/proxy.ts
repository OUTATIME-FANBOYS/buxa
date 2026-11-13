import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/config/env';
import { SECURITY_HEADERS, buildContentSecurityPolicy } from '@/config/security';

/**
 * Runs before every page and API request: gives it a fresh nonce for the Content-Security-Policy and adds the security headers.
 * (Next.js 16 calls this file `proxy`; it was `middleware` before.)
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const policy = buildContentSecurityPolicy({ nonce, dev: process.env.NODE_ENV !== 'production', supabaseUrl: publicEnv.supabaseUrl });

  // The policy goes on the request too, so Next.js can find the nonce and stamp it on the scripts it renders.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', policy);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', policy);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  return response;
}

export const config = {
  // Everything except Next.js's own static files and images.
  matcher: ['/((?!_next/static|_next/image|icon.svg).*)'],
};

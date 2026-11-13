import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Membership } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import { ROUTES } from '@/config';
import type { Session } from '../auth/session';
import { sessionFromToken } from '../auth/sessionFromToken';
import { isHttpError } from '../http/errors';
import { getRuntime } from '../runtime';
import { hardenCookie } from './cookies';
import { requestSessionClient } from './nextClient';

/**
 * CONTRACT between chunks A1 (implements this) and B1/B2 (use it). Signatures are frozen.
 *
 * Server Components, layouts and Server Actions get "who is signed in" and "which camp are they working in" only from here.
 * Sessions are HttpOnly cookies; the browser never holds a token.
 */

/** HttpOnly cookie that remembers which camp the person selected. Never trusted on its own: it is checked against their memberships. */
export const CAMP_COOKIE = 'buxa-camp';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** The access token in the session cookie, unchecked. Nothing may rely on it until `sessionFromToken` has verified it. */
async function cookieToken(): Promise<string | null> {
  try {
    const client = await requestSessionClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null; // a corrupt or unreadable cookie is the same as no cookie
  }
}

async function loadSession(): Promise<Session | null> {
  const runtime = getRuntime();
  if (!runtime.verifier) return null;
  const token = await cookieToken();
  if (!token) return null;
  try {
    return await sessionFromToken(token, { verifier: runtime.verifier, users: runtime.repositories.users }, runtime.log);
  } catch (error) {
    if (isHttpError(error) && (error.statusCode === 401 || error.statusCode === 409)) return null;
    throw error;
  }
}

/** The verified session for this request, or null when signed out. Cached for the duration of one request. */
export const getSession: () => Promise<Session | null> = cache(loadSession);

/** Like getSession, but a signed-out visitor is redirected to the sign-in page. Never returns null. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(ROUTES.signIn);
  return session;
}

/**
 * The camp to work in: the selected one if the person still belongs to it, otherwise their first, otherwise null (they have no camp yet).
 * Reads the CAMP_COOKIE; the cookie is validated against `session.memberships`.
 */
export async function getCurrentCamp(session: Session): Promise<Membership | null> {
  const selected = (await cookies()).get(CAMP_COOKIE)?.value;
  return session.memberships.find(membership => membership.orgId === selected) ?? session.memberships[0] ?? null;
}

/** Remember the selected camp. Only callable from a Server Action or Route Handler (it writes a cookie). */
export async function rememberCamp(orgId: string): Promise<void> {
  (await cookies()).set(CAMP_COOKIE, orgId, hardenCookie({ maxAge: ONE_YEAR_SECONDS }));
}

/** The Actor the permission rules and services expect. Pure. */
export function toActor(session: Session, camp: Membership): Actor {
  return { userId: session.user.id, orgId: camp.orgId, role: camp.role };
}

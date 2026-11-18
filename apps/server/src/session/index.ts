import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Actor } from '@buxa/domain';
import { ROUTES } from '@buxa/shared/config/routes';
import { publicEnv } from '@buxa/shared/config/env';
import { openableCamps, type CampMembership, type Session } from '../auth/session';
import { sessionFromToken } from '../auth/sessionFromToken';
import { MAINTENANCE_PATH, isServiceRefused } from '../availability';
import { isHttpError } from '../http/errors';
import { errorName, type Logger } from '../log';
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

/**
 * The access token in the session cookie, unchecked. Nothing may rely on it until `sessionFromToken` has verified it.
 * A failure still means signed out for the person, but it is logged by name only (never the token or an email), so a broken
 * identity provider shows up in the logs (audit S-20).
 */
async function cookieToken(log: Logger): Promise<string | null> {
  try {
    const client = await requestSessionClient();
    if (!client) {
      return null;
    }
    const { data, error } = await client.auth.getSession();
    if (error) {
      log.warn({ reason: error.name }, 'could not read the session; treating the visitor as signed out');
    }

    return data.session?.access_token ?? null;
  } catch (error) {
    log.warn({ reason: errorName(error) }, 'could not read the session; treating the visitor as signed out');

    return null; // a corrupt or unreadable cookie is the same as no cookie
  }
}

async function loadSession(): Promise<Session | null> {
  const runtime = getRuntime();
  if (!runtime.verifier) {
    return null;
  }
  const token = await cookieToken(runtime.log);
  if (!token) {
    return null;
  }
  try {
    return await sessionFromToken(
      token,
      { verifier: runtime.verifier, users: runtime.repositories.users },
      runtime.log,
    );
  } catch (error) {
    if (isHttpError(error) && (error.statusCode === 401 || error.statusCode === 409)) {
      return null;
    }
    throw error;
  }
}

/** The verified session for this request, or null when signed out. Cached for the duration of one request. */
export const getSession: () => Promise<Session | null> = cache(loadSession);

/**
 * The session when there is one, or null. Unlike getSession, it never throws when Supabase is not configured:
 * pages that work without a session (the browser demo) use this, so they still render in that case.
 */
export async function getOptionalSession(): Promise<Session | null> {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) {
    return null;
  }

  return getSession();
}

/**
 * Like getSession, but a signed-out visitor is redirected to the sign-in page, and nobody is served while the start-up check
 * refuses (audit S-05): they go to the maintenance page instead. Never returns null.
 */
export async function requireSession(): Promise<Session> {
  if (await isServiceRefused()) {
    redirect(MAINTENANCE_PATH);
  }
  const session = await getSession();
  if (!session) {
    redirect(ROUTES.signIn);
  }

  return session;
}

/**
 * The camp to work in: the selected one if the person still belongs to it (active or archived), otherwise their first active camp,
 * otherwise null (they have no camp yet). Reads the CAMP_COOKIE; the cookie is validated against the session's memberships.
 */
export async function getCurrentCamp(session: Session): Promise<CampMembership | null> {
  const selected = (await cookies()).get(CAMP_COOKIE)?.value;
  const camps = openableCamps(session);

  return camps.find(camp => camp.orgId === selected) ?? camps.find(camp => !camp.archived) ?? null;
}

/** Remember the selected camp. Only callable from a Server Action or Route Handler (it writes a cookie). */
export async function rememberCamp(orgId: string): Promise<void> {
  (await cookies()).set(CAMP_COOKIE, orgId, hardenCookie({ maxAge: ONE_YEAR_SECONDS }));
}

/**
 * The Actor the permission rules and services expect. Pure. This is the one place a camp context becomes an Actor for the
 * services, so the archived flag is set here (the domain refuses every write while it is set).
 */
export function toActor(session: Session, camp: CampMembership): Actor {
  return { userId: session.user.id, orgId: camp.orgId, role: camp.role, archived: camp.archived };
}

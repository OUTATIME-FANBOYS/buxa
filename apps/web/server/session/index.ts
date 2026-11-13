import 'server-only';
import type { Membership } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import type { Session } from '../auth/session';

/**
 * CONTRACT between chunks A1 (implements this) and B1/B2 (use it). Signatures are frozen; A1 replaces the bodies marked STUB.
 *
 * Server Components, layouts and Server Actions get "who is signed in" and "which camp are they working in" only from here.
 * Sessions are HttpOnly cookies; the browser never holds a token.
 */

/** HttpOnly cookie that remembers which camp the person selected. Never trusted on its own: it is checked against their memberships. */
export const CAMP_COOKIE = 'buxa-camp';

/** The verified session for this request, or null when signed out. Cached for the duration of one request. STUB */
export async function getSession(): Promise<Session | null> {
  throw new Error('getSession is not implemented yet (chunk A1)');
}

/** Like getSession, but a signed-out visitor is redirected to the sign-in page. Never returns null. STUB */
export async function requireSession(): Promise<Session> {
  throw new Error('requireSession is not implemented yet (chunk A1)');
}

/**
 * The camp to work in: the selected one if the person still belongs to it, otherwise their first, otherwise null (they have no camp yet).
 * Reads the CAMP_COOKIE; the cookie is validated against `session.memberships`. STUB
 */
export async function getCurrentCamp(session: Session): Promise<Membership | null> {
  throw new Error(`getCurrentCamp is not implemented yet (chunk A1) for ${session.user.id}`);
}

/** Remember the selected camp. Only callable from a Server Action or Route Handler (it writes a cookie). STUB */
export async function rememberCamp(orgId: string): Promise<void> {
  throw new Error(`rememberCamp is not implemented yet (chunk A1) for ${orgId}`);
}

/** The Actor the permission rules and services expect. Pure; real already. */
export function toActor(session: Session, camp: Membership): Actor {
  return { userId: session.user.id, orgId: camp.orgId, role: camp.role };
}

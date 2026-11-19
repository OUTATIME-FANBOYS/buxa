import { isHttpError } from '../../http/errors';
import { failure, type ActionState } from '@buxa/shared';
import { openableCamps, type CampMembership, type Session } from '../../auth/session';

export const SLUG_TAKEN = 'That address is taken. Try another.';

/** The camp this person belongs to, active or archived, or null. A posted camp id is only a claim until it is found in their memberships. */
export const membershipOf = (session: Session, orgId: string): CampMembership | null =>
  openableCamps(session).find(m => m.orgId === orgId) ?? null;

/**
 * Turns the failures a person can cause into a form state; anything else (a bug, the database being down) is rethrown for the
 * error boundary. 409 is a taken address, 403 is a role that may not do this.
 */
export function expectedCampFailure(error: unknown, fallback: string): ActionState {
  if (!isHttpError(error)) {
    throw error;
  }
  if (error.statusCode === 409) {
    return failure(SLUG_TAKEN, { slug: SLUG_TAKEN });
  }
  if (error.statusCode === 403) {
    return failure('Your role cannot do this.');
  }

  return failure(fallback);
}

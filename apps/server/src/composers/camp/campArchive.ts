import type { Actor } from '@buxa/domain';
import type { CampResult } from '@buxa/contracts';
import type { Session } from '../../auth/session';
import { isHttpError } from '../../http/errors';
import { getRuntime } from '../../runtime';

/**
 * Who is acting on a camp: the person's active membership, or, for an archived camp (which is hidden from sign-in memberships),
 * their role in it from the archived list. Null when they belong to no such camp.
 */
export async function actorForCamp(session: Session, orgId: string): Promise<Actor | null> {
  const active = session.memberships.find(m => m.orgId === orgId);
  if (active) {
    return { userId: session.user.id, orgId, role: active.role };
  }
  const archived = (await getRuntime().services.orgs.listArchivedCamps(session.user.id)).find(c => c.id === orgId);

  return archived ? { userId: session.user.id, orgId, role: archived.role } : null;
}

/** A refusal the person can act on becomes `{ ok: false, message }`; anything else (a bug, the database being down) is rethrown. */
export function campResultFor(error: unknown): CampResult {
  if (isHttpError(error)) {
    return { ok: false, message: error.message };
  }
  throw error;
}

export const NOT_A_MEMBER: CampResult = { ok: false, message: 'You are not a member of that camp.' };

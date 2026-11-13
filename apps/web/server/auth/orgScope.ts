import { isUuid, type Actor } from '@buxa/domain';
import { badRequest, forbidden } from '../http/errors';
import type { Session } from './session';

/**
 * The organisation named by the x-org-id header, as an Actor, but only if the signed-in user belongs to it.
 * An organisation that does not exist and one the user is not in get the same answer, so ids cannot be probed.
 */
export function actorFor(headers: Headers, session: Session): Actor {
  const header = headers.get('x-org-id');
  if (header === null || header === '') throw badRequest('x-org-id header is required');
  if (!isUuid(header)) throw badRequest('x-org-id must be an organisation id');
  const membership = session.memberships.find(m => m.orgId === header);
  if (!membership) throw forbidden('You do not have access to this organisation');
  return { userId: session.user.id, orgId: membership.orgId, role: membership.role };
}

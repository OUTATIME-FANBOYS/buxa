import type { FastifyRequest } from 'fastify';
import { authorize, isUuid, type Action, type Actor, type Resource } from '@buxa/domain';
import { badRequest, forbidden } from '../http/errors';
import { requireSession } from './session';

/**
 * The organisation named by the x-org-id header, as an Actor, but only if the signed-in user belongs to it.
 * An organisation that does not exist and one the user is not in get the same answer, so ids cannot be probed.
 */
export function actorFor(req: FastifyRequest): Actor {
  const session = requireSession(req);
  const header = req.headers['x-org-id'];
  if (typeof header !== 'string' || header === '') throw badRequest('x-org-id header is required');
  if (!isUuid(header)) throw badRequest('x-org-id must be an organisation id');
  const membership = session.memberships.find(m => m.orgId === header);
  if (!membership) throw forbidden('You do not have access to this organisation');
  return { userId: session.user.id, orgId: membership.orgId, role: membership.role };
}

/** `actorFor`, then the permission check: the first thing every organisation route does. */
export function authorizedActor(req: FastifyRequest, action: Action, resource?: Resource): Actor {
  const actor = actorFor(req);
  if (!authorize(actor, action, resource).allow) throw forbidden('Your role cannot do this');
  return actor;
}

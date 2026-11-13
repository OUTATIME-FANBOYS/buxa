import type { FastifyRequest } from 'fastify';
import type { Membership, User } from '@buxa/contracts';
import { unauthorized } from '../http/errors';

/** Who is signed in on this request and which camps they belong to. Set once, by the authentication hook. */
export interface Session { readonly user: User; readonly memberships: readonly Membership[] }

declare module 'fastify' { interface FastifyRequest { session: Session | null } }

/** The session, or a 401. Use this instead of reading `req.session` so no handler needs a non-null assertion. */
export function requireSession(req: FastifyRequest): Session {
  if (!req.session) throw unauthorized();
  return req.session;
}

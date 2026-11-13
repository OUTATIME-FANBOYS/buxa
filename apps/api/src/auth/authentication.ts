import type { FastifyInstance } from 'fastify';
import { conflict, unauthorized } from '../http/errors';
import type { UserRepository } from '../users/UserRepository';
import { EmailInUseError } from '../users/UserRepository';
import type { Verifier } from './verifier';

const bearerToken = (header: string | undefined): string => (header?.startsWith('Bearer ') ? header.slice(7).trim() : '');

/**
 * Makes every route registered on `scope` require a valid token. Tokens come only from the Authorization header,
 * never the URL. On success `req.session` holds the user and their memberships.
 */
export function requireAuthentication(scope: FastifyInstance, deps: { verifier: Verifier; users: UserRepository }): void {
  scope.decorateRequest('session', null);

  scope.addHook('preHandler', async (req, reply) => {
    const challenge = () => { reply.header('www-authenticate', 'Bearer'); };
    const token = bearerToken(req.headers.authorization);
    if (!token) { challenge(); throw unauthorized(); }

    let identity;
    try { identity = await deps.verifier(token); }
    catch (error) {
      req.log.info({ reason: error instanceof Error ? error.name : 'unknown' }, 'token rejected'); // never the token, never the detail
      challenge();
      throw unauthorized('Invalid or expired token');
    }

    try {
      const user = await deps.users.upsertFromIdentity(identity);
      req.session = { user, memberships: await deps.users.membershipsOf(user.id) };
    } catch (error) {
      throw error instanceof EmailInUseError ? conflict(error.message) : error;
    }
  });
}

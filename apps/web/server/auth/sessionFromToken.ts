import { conflict, unauthorized } from '../http/errors';
import type { Logger } from '../log';
import type { UserRepository } from '../users/UserRepository';
import { EmailInUseError } from '../users/UserRepository';
import type { Session } from './session';
import type { Verifier } from './verifier';

/**
 * Verifies an access token with our verifier (signature, issuer, audience, expiry) and loads the user and memberships.
 * Shared by the bearer-token API (`authenticate`) and the cookie session (`server/session`), so there is one definition of "valid token".
 * Throws an HttpError (401 or 409) on failure; failures say only "invalid or expired": never why, and never the token.
 */
export async function sessionFromToken(token: string, deps: { verifier: Verifier; users: UserRepository }, log: Logger): Promise<Session> {
  let identity;
  try { identity = await deps.verifier(token); }
  catch (error) {
    log.info({ reason: error instanceof Error ? error.name : 'unknown' }, 'token rejected');
    throw unauthorized('Invalid or expired token');
  }

  try {
    const user = await deps.users.upsertFromIdentity(identity);
    return { user, memberships: await deps.users.membershipsOf(user.id) };
  } catch (error) {
    throw error instanceof EmailInUseError ? conflict(error.message) : error;
  }
}

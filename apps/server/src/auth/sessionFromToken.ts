import { conflict, unauthorized } from '../http/errors';
import type { Logger } from '../log';
import type { UserRepository } from '../users/UserRepository';
import { isEmailInUse } from '../users/UserRepository';
import type { Session } from './session';
import type { Verifier } from './verifier';

/** What a client sees when the account cannot be used. Never says whose account owns an address (audit S-09). */
export const ACCOUNT_CONFLICT_MESSAGE = 'This account cannot be used. Contact your camp administrator.';

/**
 * Verifies an access token with our verifier (signature, issuer, audience, expiry) and loads the user and memberships.
 * Shared by the bearer-token API (`authenticate`) and the cookie session (`server/session`), so there is one definition of "valid token".
 * Throws an HttpError (401 or 409) on failure; failures say only "invalid or expired": never why, and never the token.
 */
export async function sessionFromToken(token: string, deps: { verifier: Verifier; users: UserRepository }, log: Logger): Promise<Session> {
  let identity;
  try {
    identity = await deps.verifier(token);
  } catch (error) {
    log.info({ reason: error instanceof Error ? error.name : 'unknown' }, 'token rejected');
    throw unauthorized('Invalid or expired token');
  }

  try {
    const user = await deps.users.upsertFromIdentity(identity);

    return { user, memberships: await deps.users.membershipsOf(user.id) };
  } catch (error) {
    if (!isEmailInUse(error)) {
      throw error;
    }
    // The detail says which account owns the address, so it stays on the server. The client gets the same generic answer for every conflict.
    log.warn({ reason: 'email-in-use', detail: error.message }, 'sign-in refused: the identity conflicts with an existing account');
    throw conflict(ACCOUNT_CONFLICT_MESSAGE);
  }
}

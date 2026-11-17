import { HttpError, unauthorized } from '../http/errors';
import type { Logger } from '../log';
import type { UserRepository } from '../users/UserRepository';
import type { Session } from './session';
import { sessionFromToken } from './sessionFromToken';
import type { Verifier } from './verifier';

const bearerToken = (header: string | null): string => (header?.startsWith('Bearer ') ? header.slice(7).trim() : '');

/**
 * Turns the request's token into a session, or throws. The token comes only from the Authorization header, never the URL.
 * Failures say only "invalid or expired": never why, and never the token.
 */
export async function authenticate(headers: Headers, deps: { verifier?: Verifier; users: UserRepository }, log: Logger): Promise<Session> {
  if (!deps.verifier) throw new HttpError(503, 'Sign-in is not configured');
  const token = bearerToken(headers.get('authorization'));
  if (!token) throw unauthorized();
  return sessionFromToken(token, { verifier: deps.verifier, users: deps.users }, log);
}

/** The challenge to send with a 401, so clients know a bearer token is expected. */
export const AUTH_CHALLENGE = 'Bearer';

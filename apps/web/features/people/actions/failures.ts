import { isHttpError } from '@/server/http/errors';
import { failure, type ActionState } from '@/lib/actions/state';

export const NO_CAMP = 'Choose a camp first.';
export const FORBIDDEN = 'Your role cannot do this.';

/**
 * Turns the failures a person can cause into a form state: 403 is a role that may not do this, other 4xx carry a message the service
 * wrote to be shown. Anything else (a bug, the database being down) is rethrown for the error boundary.
 */
export function expectedFailure(error: unknown, fallback: string): ActionState {
  if (!isHttpError(error) || error.statusCode >= 500) throw error;
  if (error.statusCode === 403) return failure(FORBIDDEN);
  return failure(error.message || fallback);
}

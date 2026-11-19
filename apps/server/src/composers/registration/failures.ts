import { failure, type ActionState } from '@buxa/shared';
import { isRegistrationError, isRegistrationInvalid } from '../../registration/errors';
import { expectedFailure } from '../people/failures';

/**
 * Turns a registration error into the form state a person sees. The domain's own messages are safe to show; a bad answer names its
 * field. Anything else goes to expectedFailure, which rethrows what is not expected (a bug, the database being down).
 */
export function registrationFailure(error: unknown, fallback: string): ActionState {
  if (isRegistrationInvalid(error)) {
    return failure(error.message, error.fieldErrors);
  }
  if (
    error instanceof Error &&
    (isRegistrationError(error, 'registration-refused') ||
      isRegistrationError(error, 'registration-form-not-found') ||
      isRegistrationError(error, 'registration-session-not-found'))
  ) {
    return failure(error.message);
  }

  return expectedFailure(error, fallback);
}

'use server';

import { redirect } from 'next/navigation';
import { ROUTES } from '../../../config/routes';
import { failure, success, type ActionState } from '../../../logic/common';
import { isServiceRefused } from '../../../server/availability';
import { requestSessionClient } from '../../../server/session/nextClient';
import { parseSignUp } from '../../../logic/common';
import { CONFIRM_EMAIL_MESSAGE, MAINTENANCE_MESSAGE, describeSignUpError, isAlreadyRegistered } from '../../../logic/common';

/**
 * Creates an account. When the address needs confirming the answer is the same for a new and an already-registered address,
 * so the form never reveals whether an email has an account: both get CONFIRM_EMAIL_MESSAGE as a success.
 */
export async function signUp(_previous: ActionState, formData: FormData): Promise<ActionState> {
  if (await isServiceRefused()) return failure(MAINTENANCE_MESSAGE);
  const parsed = parseSignUp(formData);
  if (!parsed.ok) return failure('Check the highlighted fields.', parsed.errors);

  const client = await requestSessionClient();
  if (!client) return failure('Sign-in is not configured.');
  const { name, email, password } = parsed.value;
  const { data, error } = await client.auth.signUp({ email, password, options: { data: { name } } });
  if (error && isAlreadyRegistered(error.message)) return success(CONFIRM_EMAIL_MESSAGE);
  if (error) return failure(describeSignUpError(error.message));
  if (data.session) redirect(ROUTES.camp);
  return success(CONFIRM_EMAIL_MESSAGE);
}

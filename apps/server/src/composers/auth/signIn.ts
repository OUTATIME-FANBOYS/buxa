'use server';

import { redirect } from 'next/navigation';
import { ROUTES } from '@buxa/shared/config/routes';
import { failure, type ActionState } from '@buxa/shared';
import { isServiceRefused } from '../../availability';
import { requestSessionClient } from '../../session/nextClient';
import { parseSignIn } from '@buxa/shared';
import { MAINTENANCE_MESSAGE, describeSignInError } from '@buxa/shared';

/** Signs in with email and password. The session lands in HttpOnly cookies; the browser never sees a token. */
export async function signIn(_previous: ActionState, formData: FormData): Promise<ActionState> {
  if (await isServiceRefused()) {
    return failure(MAINTENANCE_MESSAGE);
  }
  const parsed = parseSignIn(formData);
  if (!parsed.ok) {
    return failure('Check the highlighted fields.', parsed.errors);
  }

  const client = await requestSessionClient();
  if (!client) {
    return failure('Sign-in is not configured.');
  }
  const { error } = await client.auth.signInWithPassword(parsed.value);
  if (error) {
    return failure(describeSignInError(error.message));
  }
  redirect(ROUTES.camp);
}

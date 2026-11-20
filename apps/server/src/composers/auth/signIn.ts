'use server';

import { redirect } from 'next/navigation';
import { safeNext } from '@buxa/shared/invites/invitePath';
import { text } from '@buxa/shared';
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
  // An invite link sends the person back to it after sign-in; any other value goes to the camp home.
  redirect(safeNext(text(formData, 'next')));
}

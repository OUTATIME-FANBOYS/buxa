'use server';

import { redirect } from 'next/navigation';
import { ROUTES } from '@/config';
import { failure, type ActionState } from '@/lib/actions/state';
import { isServiceRefused } from '@/server/availability';
import { requestSessionClient } from '@/server/session/nextClient';
import { parseSignIn } from '../lib/credentials';
import { MAINTENANCE_MESSAGE, describeSignInError } from '../lib/messages';

/** Signs in with email and password. The session lands in HttpOnly cookies; the browser never sees a token. */
export async function signIn(_previous: ActionState, formData: FormData): Promise<ActionState> {
  if (await isServiceRefused()) return failure(MAINTENANCE_MESSAGE);
  const parsed = parseSignIn(formData);
  if (!parsed.ok) return failure('Check the highlighted fields.', parsed.errors);

  const client = await requestSessionClient();
  if (!client) return failure('Sign-in is not configured.');
  const { error } = await client.auth.signInWithPassword(parsed.value);
  if (error) return failure(describeSignInError(error.message));
  redirect(ROUTES.camp);
}

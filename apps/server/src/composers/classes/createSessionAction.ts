'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ROUTES, sessionPath } from '@buxa/shared/config/routes';
import { failure, field, sessionForm, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { nameFieldError } from './sessionNameError';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Create a session: its name, description and first and last day. Success opens the session's page, where its classes are added.
 * The service checks the permission (classes:manage) before anything else, so a viewer who posts this form gets the forbidden
 * message and nothing is written.
 */
export async function createSessionAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const parsed = sessionForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  let createdId: string;
  try {
    const outcome = await getRuntime().services.classes.createSession(actor, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message, nameFieldError(outcome.failure.reason, outcome.failure.message));
    }
    createdId = outcome.value.id;
  } catch (error) {
    return expectedFailure(error, 'Could not create the session.');
  }

  revalidatePath(ROUTES.sessions);
  // Posted from the New session pop-up (dialog=1): the pop-up closes and the list shows a toast, so there is no redirect.
  if (field(form, 'dialog') === '1') {
    return success('Session added.');
  }
  redirect(sessionPath(createdId)); // throws; kept outside the try
}

'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { ROUTES, sessionPath } from '@buxa/shared/config/routes';
import { failure, field, sessionEditForm, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { nameFieldError } from './sessionNameError';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Edit a session's name, description, first and last day and public flag. The price has its own dialog and is not changed here.
 * The service checks classes:manage and the rules (the last day on or after the first; every class inside the new dates) before
 * anything is written.
 */
export async function updateSessionAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }

  const parsed = sessionEditForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    const outcome = await getRuntime().services.classes.updateSession(actor, sessionId, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message, nameFieldError(outcome.failure.reason, outcome.failure.message));
    }
  } catch (error) {
    return expectedFailure(error, 'Could not save the session.');
  }

  revalidatePath(ROUTES.sessions);
  revalidatePath(sessionPath(sessionId));

  return success('Session saved.');
}

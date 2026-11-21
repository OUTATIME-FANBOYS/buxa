'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { sessionPath } from '@buxa/shared/config/routes';
import { classForm, failure, field, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Add a class to a session. The times arrive as instants (the browser converts the time it shows). Success keeps the session's page
 * open with the new class listed. The session's id comes from the form; the service checks it is in the actor's camp and that the
 * class falls on days inside the session, in the camp's zone.
 */
export async function addClassAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }

  try {
    const parsed = classForm(form);
    if (!parsed.ok) {
      return parsed.state;
    }
    const outcome = await getRuntime().services.classes.addClass(actor, sessionId, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not add the class.');
  }

  revalidatePath(sessionPath(sessionId));

  return { status: 'success', message: 'Class added.' };
}

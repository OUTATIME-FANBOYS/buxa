'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { ROUTES } from '@buxa/shared/config/routes';
import { failure, field, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Delete a session that holds no classes, then go to the sessions list. A session with any class is refused with the message that
 * says so, and nothing is deleted. The service checks classes:manage first, so a viewer gets the forbidden message.
 */
export async function deleteSessionAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }

  try {
    const outcome = await getRuntime().services.classes.deleteSession(actor, sessionId);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not delete the session.');
  }

  revalidatePath(ROUTES.sessions);
  redirect(ROUTES.sessions); // throws; kept outside the try
}

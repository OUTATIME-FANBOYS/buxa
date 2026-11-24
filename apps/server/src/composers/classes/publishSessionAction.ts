'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { ROUTES, sessionPath } from '@buxa/shared/config/routes';
import { failure, field, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Takes a draft session live (Go live), so registration and enrolment are accepted. Needs classes:publish (admin and owner); the
 * service checks it. A live session stays live; an archived one is refused (unarchive it instead).
 */
export async function publishSessionAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }

  try {
    const outcome = await getRuntime().services.classes.publishSession(actor, sessionId);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not take the session live.');
  }

  revalidatePath(ROUTES.sessions);
  revalidatePath(sessionPath(sessionId));

  return success('Session is live. Registration and enrolment are open.');
}

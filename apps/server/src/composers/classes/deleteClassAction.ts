'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { sessionPath } from '@buxa/shared/config/routes';
import { failure, field, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Delete a class. A class with any enrolment is refused with a message that says so, and nothing is deleted. The service checks
 * classes:manage first, so a viewer gets the forbidden message.
 */
export async function deleteClassAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const classId = field(form, 'classId');
  const sessionId = field(form, 'sessionId');
  if (!isUuid(classId) || !isUuid(sessionId)) {
    return failure('That class no longer exists.');
  }

  try {
    const outcome = await getRuntime().services.classes.deleteClass(actor, classId);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not delete the class.');
  }

  revalidatePath(sessionPath(sessionId));

  return success('Class deleted.');
}

'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { sessionPath } from '@buxa/shared/config/routes';
import { classForm, failure, field, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';
import { campZone } from '../attendance/campActor';

/**
 * Edit a class's own fields: name, ages, camp size, time range, location and instructors. The service checks classes:manage and
 * the rules (the class inside its session's dates, the camp size not below the places taken) before anything is written.
 */
export async function updateClassAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const classId = field(form, 'classId');
  if (!isUuid(classId)) {
    return failure('That class no longer exists.');
  }

  let sessionId: string | null = null;
  try {
    const parsed = classForm(form, await campZone(actor));
    if (!parsed.ok) {
      return parsed.state;
    }
    const outcome = await getRuntime().services.classes.updateClass(actor, classId, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
    sessionId = outcome.value.sessionId;
  } catch (error) {
    return expectedFailure(error, 'Could not save the class.');
  }

  if (sessionId) {
    revalidatePath(sessionPath(sessionId));
  }

  return success('Class saved.');
}

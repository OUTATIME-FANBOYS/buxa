'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { sessionPath } from '@buxa/shared/config/routes';
import { failure, field, fieldAll, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Set which teachers a class has, from the ticked boxes. Replaces the whole list. The service checks classes:manage, and the
 * database checks each user holds the teacher role in this camp, so a ticked non-teacher is refused and nothing changes.
 */
export async function setTeachersAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const sessionId = field(form, 'sessionId');
  const classId = field(form, 'classId');
  if (!isUuid(sessionId) || !isUuid(classId)) {
    return failure('That class no longer exists.');
  }
  const teacherIds = fieldAll(form, 'teacherIds');
  if (!teacherIds.every(isUuid)) {
    return failure('One of the teachers no longer exists.');
  }

  try {
    const outcome = await getRuntime().services.classes.setTeachers(actor, classId, teacherIds);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not save the teachers.');
  }

  revalidatePath(sessionPath(sessionId));

  return success('Teachers saved.');
}

'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { classPath } from '@buxa/shared/config/routes';
import { failure, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';
import { field } from '@buxa/shared';
import { cancelForm } from '@buxa/shared';

/** Cancel an enrolment. This frees its seat and its time for another enrolment. */
export async function cancelEnrolmentAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const classId = field(form, 'classId');
  if (!isUuid(classId)) {
    return failure('That class no longer exists.');
  }

  const parsed = cancelForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    const outcome = await getRuntime().services.classes.cancelEnrolment(actor, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not cancel the enrolment.');
  }

  revalidatePath(classPath(classId));

  return success('Enrolment cancelled. The place is free.');
}

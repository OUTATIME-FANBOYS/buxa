'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { classPath } from '@buxa/shared/config/routes';
import { failure, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';
import { field } from '@buxa/shared';
import { enrolForm } from '@buxa/shared';

/**
 * Enrol a camper in a session, or put them on the waitlist when the session is full (intent "waitlist").
 * A refusal (age, overlap, full) comes back with the domain's message, which names the clashing session. An admin may send an
 * override reason for an overlap; the service refuses the override for anyone else.
 */
export async function enrolAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const classId = field(form, 'classId');
  if (!isUuid(classId)) {
    return failure('That class no longer exists.');
  }

  const parsed = enrolForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  let message: string;
  try {
    const outcome = await getRuntime().services.classes.enrol(actor, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
    message =
      outcome.value.status === 'waitlisted'
        ? `${outcome.value.camperName} is on the waitlist for this session.`
        : `${outcome.value.camperName} is enrolled.`;
  } catch (error) {
    return expectedFailure(error, 'Could not enrol the camper.');
  }

  revalidatePath(classPath(classId));

  return success(message);
}

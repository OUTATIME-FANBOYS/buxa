'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { sessionPath } from '@buxa/shared/config/routes';
import { failure, field, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Moves the first waitlisted campers of a class into its free places, in the order they joined (enrolment.promote). Places are
 * freed by a cancellation, an expired hold or a bigger camp size; this button is for a place that is free but was not promoted yet.
 */
export async function promoteWaitlistAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const classId = field(form, 'classId');
  const sessionId = field(form, 'sessionId');
  if (!isUuid(classId) || !isUuid(sessionId)) {
    return failure('That class no longer exists.');
  }

  let promoted: number;
  try {
    promoted = await getRuntime().services.seatHolds.promoteWaitlist(actor, classId);
  } catch (error) {
    return expectedFailure(error, 'Could not move anyone off the waitlist.');
  }

  revalidatePath(sessionPath(sessionId));

  return promoted === 0
    ? failure('No place is free, so nobody moved off the waitlist.')
    : success(promoted === 1 ? 'One camper moved off the waitlist.' : `${promoted} campers moved off the waitlist.`);
}

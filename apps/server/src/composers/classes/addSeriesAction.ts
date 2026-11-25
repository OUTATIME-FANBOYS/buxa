'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { sessionPath } from '@buxa/shared/config/routes';
import { failure, field, seriesForm, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Creates one class series under a session from the New class form: the weekdays ticked, between the Starts and Ends date-times.
 * The series and each of its days are written in one transaction (the service expands it with planSeries in the camp's time zone,
 * and checks classes:manage, overlaps and the session's dates before anything is written).
 */
export async function addSeriesAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }

  const parsed = seriesForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  let days: number;
  try {
    const outcome = await getRuntime().services.classes.addSeries(actor, sessionId, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
    days = outcome.value.occurrenceCount;
  } catch (error) {
    return expectedFailure(error, 'Could not add the class.');
  }

  revalidatePath(sessionPath(sessionId));

  return success(`Added the class: ${days} ${days === 1 ? 'day' : 'days'}.`);
}

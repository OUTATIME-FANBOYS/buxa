'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { sessionPath } from '@buxa/shared/config/routes';
import { failure, field, specificDaysForm, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Add the classes of a "Specific days" form under a session: the weekdays ticked, between the Starts and Ends date-times. Every
 * generated class is a normal class with its own enrolments. The service expands the rule in the camp's time zone and checks
 * classes:manage, overlaps and capacity before anything is written.
 */
export async function addRecurringClassesAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }

  const parsed = specificDaysForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  let created: number;
  try {
    const outcome = await getRuntime().services.classes.addRecurringClasses(actor, sessionId, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
    created = outcome.value.length;
  } catch (error) {
    return expectedFailure(error, 'Could not add the series.');
  }

  revalidatePath(sessionPath(sessionId));

  return success(`Added ${created} ${created === 1 ? 'class' : 'classes'}.`);
}

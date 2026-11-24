'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { assignPath } from '@buxa/shared/config/routes';
import { assignForm, failure, RATIO_REFUSAL_KEY, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Places a camper or staff member in a group and room, or moves them within the session. Every rule runs in the service. A refusal
 * comes back with its reason in plain words; a ratio refusal also carries the key RATIO_REFUSAL_KEY so the form can offer the override.
 */
export async function assignAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const parsed = assignForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }
  if (!isUuid(parsed.data.sessionId)) {
    return failure('That session no longer exists.');
  }

  try {
    const outcome = await getRuntime().services.groups.assign(actor, parsed.data);
    if (!outcome.ok) {
      const ratio = outcome.failure.reason === 'ratio';

      return failure(outcome.failure.message, ratio ? { [RATIO_REFUSAL_KEY]: outcome.failure.message } : undefined);
    }
    revalidatePath(assignPath(parsed.data.sessionId));

    return success(`${outcome.value.personName} is placed.`);
  } catch (error) {
    return expectedFailure(error, 'Could not place this person.');
  }
}

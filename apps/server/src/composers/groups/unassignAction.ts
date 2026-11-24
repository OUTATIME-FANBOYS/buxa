'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { assignPath } from '@buxa/shared/config/routes';
import { failure, success, unassignForm, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Ends a person's placement in a session. Every rule runs in the service: staff and above only, and a refusal (no active placement)
 * comes back in plain words.
 */
export async function unassignAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const parsed = unassignForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }
  if (!isUuid(parsed.data.sessionId)) {
    return failure('That session no longer exists.');
  }

  try {
    const outcome = await getRuntime().services.groups.unassign(actor, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
    revalidatePath(assignPath(parsed.data.sessionId));

    return success('Unassigned.');
  } catch (error) {
    return expectedFailure(error, 'Could not unassign this person.');
  }
}

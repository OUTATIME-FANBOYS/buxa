'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { groupsPath } from '@buxa/shared/config/routes';
import { failure, field, groupForm, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Creates a group in a session, or saves a changed one (when the form names a group). Every change is audited by the service.
 * A name already used in the session, or a capacity below the campers in the group, comes back as a message on the form.
 */
export async function saveGroupAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }
  const groupId = field(form, 'groupId');
  const parsed = groupForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    const services = getRuntime().services.groups;
    const outcome = isUuid(groupId)
      ? await services.updateGroup(actor, groupId, parsed.data)
      : await services.createGroup(actor, sessionId, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not save the group.');
  }

  revalidatePath(groupsPath(sessionId));

  return success('Group saved.');
}

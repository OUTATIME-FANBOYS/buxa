'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { groupsPath } from '@buxa/shared/config/routes';
import { failure, field, roomForm, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Creates a room for a session, or saves a changed one (when the form names a room). Every change is audited by the service. A name
 * already used in the session, or a capacity below the campers in the room, comes back as a message on the form.
 */
export async function saveRoomAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }
  const roomId = field(form, 'roomId');
  const parsed = roomForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    const services = getRuntime().services.groups;
    const outcome = isUuid(roomId)
      ? await services.updateRoom(actor, roomId, parsed.data)
      : await services.createRoom(actor, sessionId, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not save the room.');
  }

  revalidatePath(groupsPath(sessionId));

  return success('Room saved.');
}

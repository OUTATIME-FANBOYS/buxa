'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { ROUTES, sessionPath } from '@buxa/shared/config/routes';
import { failure, field, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Show a session on the public pages (or take it off). A tick box posts `isPublic=on` when ticked. The service checks
 * classes:manage before anything is written, so a viewer who posts this is refused and the flag is unchanged.
 */
export async function setSessionPublicAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }
  const isPublic = form.get('isPublic') === 'on';

  try {
    const outcome = await getRuntime().services.classes.setSessionPublic(actor, sessionId, isPublic);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not change whether the session is public.');
  }

  revalidatePath(ROUTES.sessions);
  revalidatePath(sessionPath(sessionId));

  return success(isPublic ? 'Session is public.' : 'Session is no longer public.');
}

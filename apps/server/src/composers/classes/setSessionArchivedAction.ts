'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { ROUTES, sessionPath } from '@buxa/shared/config/routes';
import { failure, field, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Archive a session (`archived` = 1) or unarchive it (`archived` = 0). Archiving needs classes:manage and unarchiving needs org:update
 * (admin and owner); the service checks both. An archived session is hidden from registration and its public page.
 */
export async function setSessionArchivedAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }
  const archived = field(form, 'archived') === '1';

  try {
    const outcome = await getRuntime().services.classes.setSessionArchived(actor, sessionId, archived);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, archived ? 'Could not archive the session.' : 'Could not unarchive the session.');
  }

  revalidatePath(ROUTES.sessions);
  revalidatePath(sessionPath(sessionId));

  return success(archived ? 'Session archived.' : 'Session unarchived.');
}

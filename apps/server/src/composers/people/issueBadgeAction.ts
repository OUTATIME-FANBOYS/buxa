'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { personPath } from '@buxa/shared/config/routes';
import { failure, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from './camp';
import { expectedFailure, NO_CAMP } from './failures';
import { field } from '@buxa/shared';

/**
 * Issue a badge, or reissue one (which revokes the old badge). Returns success only: the code is not sent to the browser. The panel
 * shows the badge when someone presses Show badge, which loads the stored (encrypted) code. Needs credentials:manage.
 */
export async function issueBadgeAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const personId = field(form, 'personId');
  if (!isUuid(personId)) {
    return failure('That person is not valid.');
  }

  try {
    await getRuntime().services.credentials.issue(actor, personId);
  } catch (error) {
    return expectedFailure(error, 'Could not issue the badge.');
  }

  revalidatePath(personPath(personId));

  return success();
}

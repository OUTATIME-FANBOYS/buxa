'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { ROUTES } from '@buxa/shared/config/routes';
import { DELETED_NAME_LIMIT, failure, field, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Delete a session together with its classes, for an admin or the owner. `confirmName` must be the session's name exactly; the
 * service checks it, so a typed name that differs is refused and nothing is deleted. A session whose classes have enrolments,
 * holds, registrations, check-ins or season passes is refused with "archive it instead". On success the user goes to the sessions
 * list with `?deleted=<name>`, as a single delete does.
 */
export async function deleteSessionWithClassesAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }
  const confirmName = field(form, 'confirmName');

  let name: string;
  try {
    const services = getRuntime().services.classes;
    const found = await services.getSession(actor, sessionId);
    if (!found.ok) {
      return failure(found.failure.message);
    }
    name = found.value.name;

    const outcome = await services.deleteSessionWithClasses(actor, sessionId, confirmName);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not delete the session.');
  }

  revalidatePath(ROUTES.sessions);
  redirect(`${ROUTES.sessions}?deleted=${encodeURIComponent(name.trim().slice(0, DELETED_NAME_LIMIT))}`); // throws; kept outside the try
}

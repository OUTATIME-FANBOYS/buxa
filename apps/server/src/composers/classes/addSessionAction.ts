'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { classPath } from '@buxa/shared/config/routes';
import { failure, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';
import { field } from '@buxa/shared';
import { campZone } from '../attendance/campActor';
import { sessionForm } from '@buxa/shared';

/**
 * Add a session to a class. The times are typed in the camp's clock and converted in the camp's zone. Success opens the class page.
 * The class's id comes from the form; the service checks that it is in the actor's camp.
 */
export async function addSessionAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const classId = field(form, 'classId');
  if (!isUuid(classId)) {
    return failure('That class no longer exists.');
  }

  try {
    const parsed = sessionForm(form, await campZone(actor));
    if (!parsed.ok) {
      return parsed.state;
    }
    const outcome = await getRuntime().services.classes.addSession(actor, classId, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not add the session.');
  }

  revalidatePath(classPath(classId));
  redirect(classPath(classId)); // throws; kept outside the try
}

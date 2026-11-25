'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { registrationFormPath } from '@buxa/shared/config/routes';
import { failure, field, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { NO_CAMP } from '../people/failures';
import { registrationFailure } from './failures';

/** Sets a family's document to pending, accepted or needs replacing. The service checks the role and the value. */
export async function reviewDocumentAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const fileId = field(form, 'fileId');
  if (!isUuid(fileId)) {
    return failure('That document no longer exists.');
  }

  try {
    await getRuntime().services.registration.reviewDocument(actor, fileId, field(form, 'status'));
  } catch (error) {
    return registrationFailure(error, 'Could not update the document.');
  }

  const formId = field(form, 'formId');
  if (isUuid(formId)) {
    revalidatePath(registrationFormPath(formId));
  }

  return success('Document updated.');
}

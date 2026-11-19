'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { registrationFormPath } from '@buxa/shared/config/routes';
import { failure, field, registrationSubmissionFromForm, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { NO_CAMP } from '../people/failures';
import { registrationFailure } from './failures';

/**
 * Records a family's registration on a published form. The posted answers are not trusted: the service checks them against the
 * version the form was published with, and checks the sessions against the form's session set.
 */
export async function submitRegistrationAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const formId = field(form, 'formId');
  if (!isUuid(formId)) {
    return failure('That form no longer exists.');
  }

  try {
    await getRuntime().services.registration.submit(actor, formId, registrationSubmissionFromForm(form));
  } catch (error) {
    return registrationFailure(error, 'Could not record the registration.');
  }

  revalidatePath(registrationFormPath(formId));

  return success('Registration recorded. Nothing has been charged: payments come in a later phase.');
}

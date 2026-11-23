'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { registrationFormPath } from '@buxa/shared/config/routes';
import { failure, field, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { NO_CAMP } from '../people/failures';
import { registrationFailure } from './failures';

/**
 * Records by hand how one child's place in a class was paid (or that it is unpaid again). Nothing is charged here: online payment
 * comes in a later phase. A place marked paid needs a note, which the service checks.
 */
export async function recordPaymentAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const formId = field(form, 'formId');
  const registrationClassId = field(form, 'registrationClassId');
  if (!isUuid(formId) || !isUuid(registrationClassId)) {
    return failure('That place no longer exists.');
  }

  try {
    await getRuntime().services.registration.recordPayment(actor, registrationClassId, {
      paid: field(form, 'paid') === 'yes',
      note: field(form, 'note'),
    });
  } catch (error) {
    return registrationFailure(error, 'Could not record the payment.');
  }

  revalidatePath(registrationFormPath(formId));

  return success('Payment recorded.');
}

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
 * Confirms one pending registration (decision 3). The service checks the permission and the status again; a registration that is
 * already confirmed is refused, and the confirmation is audited in the same transaction.
 */
export async function confirmRegistrationAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const formId = field(form, 'formId');
  const registrationId = field(form, 'registrationId');
  if (!isUuid(formId) || !isUuid(registrationId)) {
    return failure('That registration no longer exists.');
  }

  let outcome;
  try {
    outcome = await getRuntime().services.registration.confirm(actor, registrationId);
  } catch (error) {
    return registrationFailure(error, 'Could not confirm the registration.');
  }

  revalidatePath(registrationFormPath(formId));

  const badges =
    outcome.badgesIssued > 0 ? ` ${outcome.badgesIssued} badge${outcome.badgesIssued === 1 ? '' : 's'} issued.` : '';

  return success(`Registration confirmed.${badges}${outcome.badgeNote ? ` ${outcome.badgeNote}` : ''}`);
}

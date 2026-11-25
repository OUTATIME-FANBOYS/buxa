'use server';

import { revalidatePath } from 'next/cache';
import { EmergencyContactInputSchema } from '@buxa/contracts';
import { isUuid } from '@buxa/domain';
import { personPath } from '@buxa/shared/config/routes';
import { failure, field, parseWith, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { requireSession } from '../../session';
import { currentActor } from './camp';
import { expectedFailure, NO_CAMP } from './failures';

/**
 * Saves a person's emergency contact from the person page. Blank name and phone clear it. Staff, and the family's guardian for the
 * child, may save (the service decides; a refusal comes back as form state). Audited by the service with no personal data.
 */
export async function updateEmergencyContactAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession();
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const id = field(form, 'id');
  if (!isUuid(id)) {
    return failure('That person was not found.');
  }
  const parsed = parseWith(EmergencyContactInputSchema, {
    name: field(form, 'name'),
    phone: field(form, 'phone'),
    relationship: field(form, 'relationship'),
  });
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    await getRuntime().services.people.updateEmergencyContact(actor, id, parsed.data, session.user.email);
  } catch (error) {
    return expectedFailure(error, 'Could not save the emergency contact.');
  }

  revalidatePath(personPath(id));

  return success('Emergency contact saved.');
}

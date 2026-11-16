'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { PersonPatchInputSchema } from '@buxa/contracts';
import { isUuid } from '@buxa/domain';
import { personPath } from '@/config/routes';
import { failure, type ActionState } from '@/lib/actions/state';
import { getRuntime } from '@/server/runtime';
import { currentActor } from '../lib/camp';
import { expectedFailure, NO_CAMP } from './failures';
import { field, fieldAll, parseWith } from './parse';

/**
 * Change a person's details. The form posts every field, so the patch is the whole record: a blank date of birth means "none",
 * and blank contact fields are cleared by the service. Success opens the person's page; 403, 400 and 409 come back as form state.
 */
export async function updatePersonAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) return failure(NO_CAMP);
  const id = field(form, 'id');
  if (!isUuid(id)) return failure('That person was not found.');

  const dateOfBirth = field(form, 'dateOfBirth');
  const parsed = parseWith(PersonPatchInputSchema, {
    givenName: field(form, 'givenName'), familyName: field(form, 'familyName'), preferredName: field(form, 'preferredName'),
    dateOfBirth: dateOfBirth === '' ? null : dateOfBirth, email: field(form, 'email'), phone: field(form, 'phone'),
    roles: fieldAll(form, 'roles'),
  });
  if (!parsed.ok) return parsed.state;

  try { await getRuntime().services.people.update(actor, id, parsed.data); }
  catch (error) { return expectedFailure(error, 'Could not save the changes.'); }

  revalidatePath(personPath(id));
  redirect(personPath(id)); // throws; kept outside the try
}

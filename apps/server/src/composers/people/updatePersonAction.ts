'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { PersonPatchInputSchema } from '@buxa/contracts';
import { isUuid } from '@buxa/domain';
import { ROUTES, personPath } from '@buxa/shared/config/routes';
import { failure, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from './camp';
import { expectedFailure, NO_CAMP } from './failures';
import { field, fieldAll, parseWith } from '@buxa/shared';

/**
 * Change a person's details. The form posts every field, so the patch is the whole record: a blank date of birth means "none",
 * and blank contact fields are cleared by the service. Success opens the person's page, or, posted from the Edit person pop-up
 * (dialog=1), returns a success so the pop-up closes with a toast. 403, 400 and 409 come back as form state.
 */
export async function updatePersonAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const id = field(form, 'id');
  if (!isUuid(id)) {
    return failure('That person was not found.');
  }

  const dateOfBirth = field(form, 'dateOfBirth');
  const parsed = parseWith(PersonPatchInputSchema, {
    givenName: field(form, 'givenName'),
    familyName: field(form, 'familyName'),
    preferredName: field(form, 'preferredName'),
    dateOfBirth: dateOfBirth === '' ? null : dateOfBirth,
    // The email field is shown only for some roles, so it is posted only when it is on the form. Absent means unchanged.
    email: form.has('email') ? field(form, 'email') : undefined,
    phone: field(form, 'phone'),
    roles: fieldAll(form, 'roles'),
  });
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    await getRuntime().services.people.update(actor, id, parsed.data);
  } catch (error) {
    return expectedFailure(error, 'Could not save the changes.');
  }

  revalidatePath(personPath(id));

  if (field(form, 'dialog') === '1') {
    revalidatePath(ROUTES.people);

    return success('Changes saved.');
  }

  redirect(personPath(id)); // throws; kept outside the try
}

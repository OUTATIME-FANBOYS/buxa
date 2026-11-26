'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { PersonHouseholdInputSchema, PersonPatchInputSchema } from '@buxa/contracts';
import { isUuid } from '@buxa/domain';
import { ROUTES, personPath } from '@buxa/shared/config/routes';
import { CHOOSE_ONE_HOUSEHOLD, failure, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from './camp';
import { expectedFailure, NO_CAMP } from './failures';
import { field, fieldAll, parseWith } from '@buxa/shared';

/**
 * Change a person's details. The form posts every field, so the patch is the whole record: a blank date of birth means "none",
 * and blank contact fields are cleared by the service. The household fields are posted only when the form shows the Household
 * section (a family role); then the household is set too (join, create, or leave). Success opens the person's page, or, posted from
 * the Edit person pop-up (dialog=1), returns a success so the pop-up closes with a toast. 403, 400 and 409 come back as form state.
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

  const parsed = parseWith(PersonPatchInputSchema, {
    givenName: field(form, 'givenName'),
    familyName: field(form, 'familyName'),
    dateOfBirth: field(form, 'dateOfBirth'),
    // The email field is shown only for some roles, so it is posted only when it is on the form. Absent means unchanged.
    email: form.has('email') ? field(form, 'email') : undefined,
    phone: field(form, 'phone'),
    roles: fieldAll(form, 'roles'),
  });
  if (!parsed.ok) {
    return parsed.state;
  }

  // Checked before anything is saved, so a bad household choice leaves the details as they were.
  const householdPosted = form.has('householdId') || form.has('newHouseholdName');
  const existingHousehold = field(form, 'householdId');
  const newHouseholdName = field(form, 'newHouseholdName').trim();
  if (householdPosted && existingHousehold !== '' && newHouseholdName !== '') {
    return failure('Check the highlighted fields.', { householdId: CHOOSE_ONE_HOUSEHOLD });
  }
  const household = householdPosted
    ? parseWith(PersonHouseholdInputSchema, {
        householdId: existingHousehold === '' ? undefined : existingHousehold,
        newHouseholdName: newHouseholdName === '' ? undefined : newHouseholdName,
        relationship: field(form, 'relationship') === '' ? undefined : field(form, 'relationship'),
      })
    : null;
  if (household && !household.ok) {
    return household.state;
  }

  try {
    // One unit: the household and the details are saved together, or neither is.
    await getRuntime().services.people.updateWithHousehold(
      actor,
      id,
      parsed.data,
      household?.ok ? household.data : undefined,
    );
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

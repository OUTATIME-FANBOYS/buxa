'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { NewPersonInputSchema, NewHouseholdInputSchema } from '@buxa/contracts';
import { ROUTES, personPath } from '@buxa/shared/config/routes';
import { failure, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from './camp';
import {
  CAMPER_NEEDS_HOUSEHOLD,
  CHOOSE_ONE_HOUSEHOLD,
  HOUSEHOLD_NAME_NEEDED,
  NEW_HOUSEHOLD_NO_GUARDIAN,
} from '@buxa/shared';
import { expectedFailure, NO_CAMP } from './failures';
import { dropBlank, field, fieldAll, parseWith } from '@buxa/shared';

const OPTIONAL = ['preferredName', 'dateOfBirth', 'email', 'phone', 'householdId', 'relationship'] as const;

/**
 * Add a person. A child needs a household that already has a guardian: either an existing one (`householdId`, usually from the
 * guardian's page) or a new one, which is only useful for a guardian, since it has no guardian yet.
 * Success opens the new person's page; expected problems come back as form state.
 */
export async function createPersonAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const newHouseholdName = field(form, 'newHouseholdName').trim();
  const posted = dropBlank(
    {
      givenName: field(form, 'givenName'),
      familyName: field(form, 'familyName'),
      preferredName: field(form, 'preferredName'),
      dateOfBirth: field(form, 'dateOfBirth'),
      email: field(form, 'email'),
      phone: field(form, 'phone'),
      roles: fieldAll(form, 'roles'),
      householdId: field(form, 'householdId'),
      relationship: field(form, 'relationship'),
    },
    OPTIONAL,
  );
  const parsed = parseWith(NewPersonInputSchema, posted);
  if (!parsed.ok) {
    return parsed.state;
  }
  const input = parsed.data;

  if (input.householdId && newHouseholdName) {
    return failure('Check the highlighted fields.', { householdId: CHOOSE_ONE_HOUSEHOLD });
  }
  const isCamper = input.roles.includes('camper');
  if (isCamper && !input.householdId && !newHouseholdName) {
    return failure('Check the highlighted fields.', { householdId: CAMPER_NEEDS_HOUSEHOLD });
  }
  if (isCamper && !input.householdId) {
    return failure('Check the highlighted fields.', { householdId: NEW_HOUSEHOLD_NO_GUARDIAN });
  }
  if (!input.householdId && newHouseholdName && !parseWith(NewHouseholdInputSchema, { name: newHouseholdName }).ok) {
    return failure('Check the highlighted fields.', { newHouseholdName: HOUSEHOLD_NAME_NEEDED });
  }

  let person;
  try {
    // A new household is created in the same transaction as the person, so a refused person leaves no empty household behind.
    const newHousehold = input.householdId === undefined && newHouseholdName !== '' ? newHouseholdName : undefined;
    person = await getRuntime().services.people.create(actor, { ...input, newHouseholdName: newHousehold });
  } catch (error) {
    return expectedFailure(error, 'Could not add the person.');
  }

  revalidatePath(ROUTES.people);
  // Posted from the Add person pop-up (dialog=1): the pop-up closes and a toast says so, with no redirect.
  if (field(form, 'dialog') === '1') {
    return success('Person added.');
  }
  redirect(personPath(person.id)); // throws; kept outside the try
}

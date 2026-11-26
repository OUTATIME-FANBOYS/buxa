'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { EmergencyContactInputSchema, NewPersonFormSchema, NewHouseholdInputSchema } from '@buxa/contracts';
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

/** Blank phone is kept, so the schema's phone message is the one shown (a phone is required on add). */
const OPTIONAL = ['dateOfBirth', 'email', 'householdId', 'relationship'] as const;

/**
 * The emergency contact's form fields are named apart from the person's own (`phone` is the person's). The schema reports its
 * problems under its own keys, so they are renamed back to the form's names here.
 */
const EMERGENCY_FORM_NAMES: Readonly<Record<string, string>> = {
  name: 'emergencyContactName',
  phone: 'emergencyContactPhone',
  relationship: 'emergencyContactRelationship',
};

/** The emergency contact section is posted only when it is on the form (a camper role), so absent fields mean no contact. */
const emergencyContactPosted = (form: FormData): boolean =>
  form.has('emergencyContactName') || form.has('emergencyContactPhone') || form.has('emergencyContactRelationship');

/**
 * Add a person. A child needs a household that already has a guardian: either an existing one (`householdId`, usually from the
 * guardian's page) or a new one, which is only useful for a guardian, since it has no guardian yet.
 * The optional emergency contact is saved with the person (blank name and phone mean none).
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
      dateOfBirth: field(form, 'dateOfBirth'),
      email: field(form, 'email'),
      phone: field(form, 'phone'),
      roles: fieldAll(form, 'roles'),
      householdId: field(form, 'householdId'),
      relationship: field(form, 'relationship'),
    },
    OPTIONAL,
  );
  const parsed = parseWith(NewPersonFormSchema, posted);
  if (!parsed.ok) {
    return parsed.state;
  }
  const input = parsed.data;

  // A camper needs a date of birth. The phone is required by the schema for every person added.
  const missing: Record<string, string> = {};
  if (input.roles.includes('camper') && !input.dateOfBirth) {
    missing.dateOfBirth = 'Enter the date of birth.';
  }
  if (Object.keys(missing).length > 0) {
    return failure('Check the highlighted fields.', missing);
  }

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

  const emergency = emergencyContactPosted(form)
    ? parseWith(EmergencyContactInputSchema, {
        name: field(form, 'emergencyContactName'),
        phone: field(form, 'emergencyContactPhone'),
        relationship: field(form, 'emergencyContactRelationship'),
      })
    : null;
  if (emergency && !emergency.ok) {
    return renameEmergencyErrors(emergency.state);
  }

  let person;
  try {
    // A new household is created in the same transaction as the person, so a refused person leaves no empty household behind.
    const newHousehold = input.householdId === undefined && newHouseholdName !== '' ? newHouseholdName : undefined;
    person = await getRuntime().services.people.create(actor, {
      ...input,
      newHouseholdName: newHousehold,
      emergencyContact: emergency?.ok ? emergency.data : undefined,
    });
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

/** Names the emergency contact's errors under the form's field names. */
function renameEmergencyErrors(state: ActionState): ActionState {
  if (state.status !== 'error' || !state.fieldErrors) {
    return state;
  }
  const fieldErrors: Record<string, string> = {};
  for (const [key, message] of Object.entries(state.fieldErrors)) {
    if (message !== undefined) {
      fieldErrors[EMERGENCY_FORM_NAMES[key] ?? key] = message;
    }
  }

  return failure(state.message, fieldErrors);
}

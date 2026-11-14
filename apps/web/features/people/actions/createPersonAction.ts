'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { NewPersonInputSchema, NewHouseholdInputSchema } from '@buxa/contracts';
import { ROUTES, personPath } from '@/config/routes';
import { failure, type ActionState } from '@/lib/actions/state';
import { getRuntime } from '@/server/runtime';
import { currentActor } from '../lib/camp';
import { CAMPER_NEEDS_HOUSEHOLD, CHOOSE_ONE_HOUSEHOLD, HOUSEHOLD_NAME_NEEDED, NEW_HOUSEHOLD_NO_GUARDIAN } from '../lib/copy';
import { expectedFailure, NO_CAMP } from './failures';
import { dropBlank, field, fieldAll, parseWith } from './parse';

const OPTIONAL = ['preferredName', 'dateOfBirth', 'email', 'phone', 'householdId', 'relationship'] as const;

/**
 * Add a person. A child needs a household that already has a guardian: either an existing one (`householdId`, usually from the
 * guardian's page) or a new one, which is only useful for a guardian, since it has no guardian yet.
 * Success opens the new person's page; expected problems come back as form state.
 */
export async function createPersonAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) return failure(NO_CAMP);

  const newHouseholdName = field(form, 'newHouseholdName').trim();
  const posted = dropBlank({
    givenName: field(form, 'givenName'), familyName: field(form, 'familyName'), preferredName: field(form, 'preferredName'),
    dateOfBirth: field(form, 'dateOfBirth'), email: field(form, 'email'), phone: field(form, 'phone'),
    roles: fieldAll(form, 'roles'), householdId: field(form, 'householdId'), relationship: field(form, 'relationship'),
  }, OPTIONAL);
  const parsed = parseWith(NewPersonInputSchema, posted);
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;

  if (input.householdId && newHouseholdName) return failure('Check the highlighted fields.', { householdId: CHOOSE_ONE_HOUSEHOLD });
  const isCamper = input.roles.includes('camper');
  if (isCamper && !input.householdId && !newHouseholdName) return failure('Check the highlighted fields.', { householdId: CAMPER_NEEDS_HOUSEHOLD });
  if (isCamper && !input.householdId) return failure('Check the highlighted fields.', { householdId: NEW_HOUSEHOLD_NO_GUARDIAN });
  if (!input.householdId && newHouseholdName && !parseWith(NewHouseholdInputSchema, { name: newHouseholdName }).ok) {
    return failure('Check the highlighted fields.', { newHouseholdName: HOUSEHOLD_NAME_NEEDED });
  }

  let person;
  try {
    const householdId = input.householdId ?? (newHouseholdName ? (await getRuntime().services.people.createHousehold(actor, { name: newHouseholdName })).id : undefined);
    person = await getRuntime().services.people.create(actor, { ...input, householdId });
  } catch (error) { return expectedFailure(error, 'Could not add the person.'); }

  revalidatePath(ROUTES.people);
  redirect(personPath(person.id)); // throws; kept outside the try
}

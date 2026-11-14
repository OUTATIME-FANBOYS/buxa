'use server';

import { revalidatePath } from 'next/cache';
import { HouseholdLinkInputSchema } from '@buxa/contracts';
import { personPath } from '@/config/routes';
import { failure, success, type ActionState } from '@/lib/actions/state';
import { getRuntime } from '@/server/runtime';
import { currentActor } from '../lib/camp';
import { expectedFailure, NO_CAMP } from './failures';
import { checked, field, parseWith } from './parse';

/** Link a person to a household as a guardian (may collect a child) or as another relation. The page they came from is refreshed. */
export async function linkHouseholdAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) return failure(NO_CAMP);
  const parsed = parseWith(HouseholdLinkInputSchema, {
    householdId: field(form, 'householdId'), personId: field(form, 'personId'), relationship: field(form, 'relationship'),
    isGuardian: checked(form, 'isGuardian'), canPickup: checked(form, 'canPickup'),
  });
  if (!parsed.ok) return parsed.state;

  try { await getRuntime().services.people.linkToHousehold(actor, parsed.data); }
  catch (error) { return expectedFailure(error, 'Could not link them to the household.'); }

  revalidatePath(personPath(parsed.data.personId));
  return success('Household updated.');
}

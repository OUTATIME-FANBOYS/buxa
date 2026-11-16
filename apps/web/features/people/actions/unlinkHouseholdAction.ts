'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { personPath } from '@/config/routes';
import { failure, success, type ActionState } from '@/lib/actions/state';
import { getRuntime } from '@/server/runtime';
import { currentActor } from '../lib/camp';
import { expectedFailure, NO_CAMP } from './failures';
import { field } from './parse';

/** Take a person out of a household. A camper's last guardian cannot be removed: the service answers 409 with the reason. */
export async function unlinkHouseholdAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) return failure(NO_CAMP);
  const householdId = field(form, 'householdId');
  const personId = field(form, 'personId');
  if (!isUuid(householdId) || !isUuid(personId)) return failure('That link is not valid.');

  try { await getRuntime().services.people.unlinkFromHousehold(actor, householdId, personId); }
  catch (error) { return expectedFailure(error, 'Could not remove them from the household.'); }

  revalidatePath(personPath(personId));
  return success('Removed from the household.');
}

'use server';

import { revalidatePath } from 'next/cache';
import { NewMembershipInputSchema } from '@buxa/contracts';
import { personPath } from '@/config/routes';
import { failure, success, type ActionState } from '@/lib/actions/state';
import { getRuntime } from '@/server/runtime';
import { currentActor } from '../lib/camp';
import { expectedFailure, NO_CAMP } from './failures';
import { field, parseWith } from './parse';

/** Give a person a membership (a date range with a plan name). Needs memberships:manage; the service checks it again. */
export async function addMembershipAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) return failure(NO_CAMP);
  const parsed = parseWith(NewMembershipInputSchema, {
    personId: field(form, 'personId'), plan: field(form, 'plan'), startsOn: field(form, 'startsOn'), endsOn: field(form, 'endsOn'),
  });
  if (!parsed.ok) return parsed.state;

  try { await getRuntime().services.memberships.add(actor, parsed.data); }
  catch (error) { return expectedFailure(error, 'Could not add the membership.'); }

  revalidatePath(personPath(parsed.data.personId));
  return success('Membership added.');
}

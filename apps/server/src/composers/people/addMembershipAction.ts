'use server';

import { revalidatePath } from 'next/cache';
import { CUSTOM_SESSION_CHOICE, NewMembershipInputSchema } from '@buxa/contracts';
import { personPath } from '@buxa/shared/config/routes';
import { failure, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from './camp';
import { expectedFailure, NO_CAMP } from './failures';
import { field, parseWith } from '@buxa/shared';

/** Give a person a membership (a date range with a plan name). Needs memberships:manage; the service checks it again. */
export async function addMembershipAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  // The Session choice is a session id, or "custom" (typed name and dates), or blank when nothing was chosen.
  const choice = field(form, 'sessionId');
  if (choice === '') {
    return failure('Check the highlighted fields.', { sessionId: 'Choose a session, or Custom.' });
  }
  const parsed = parseWith(NewMembershipInputSchema, {
    personId: field(form, 'personId'),
    sessionId: choice === CUSTOM_SESSION_CHOICE ? undefined : choice,
    plan: field(form, 'plan'),
    startsOn: field(form, 'startsOn'),
    endsOn: field(form, 'endsOn'),
  });
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    await getRuntime().services.memberships.add(actor, parsed.data);
  } catch (error) {
    return expectedFailure(error, 'Could not add the membership.');
  }

  revalidatePath(personPath(parsed.data.personId));

  return success('Membership added.');
}

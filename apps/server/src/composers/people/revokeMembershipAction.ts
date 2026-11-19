'use server';

import { revalidatePath } from 'next/cache';
import { RevokeMembershipInputSchema } from '@buxa/contracts';
import { isUuid } from '@buxa/domain';
import { personPath } from '@buxa/shared/config/routes';
import { failure, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from './camp';
import { expectedFailure, NO_CAMP } from './failures';
import { field, parseWith } from '@buxa/shared';

/** Revoke a membership. The reason is required and recorded. Needs memberships:manage. */
export async function revokeMembershipAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const personId = field(form, 'personId');
  if (!isUuid(personId)) {
    return failure('That person is not valid.');
  }
  const parsed = parseWith(RevokeMembershipInputSchema, {
    membershipId: field(form, 'membershipId'),
    reason: field(form, 'reason'),
  });
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    await getRuntime().services.memberships.revoke(actor, parsed.data);
  } catch (error) {
    return expectedFailure(error, 'Could not revoke the membership.');
  }

  revalidatePath(personPath(personId));

  return success('Membership revoked.');
}

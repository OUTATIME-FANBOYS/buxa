'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { personPath } from '@/config/routes';
import { failure, success, type ActionState } from '@/lib/actions/state';
import { getRuntime } from '@/server/runtime';
import { currentActor } from '../lib/camp';
import { expectedFailure, NO_CAMP } from './failures';
import { field } from './parse';

/** Revoke the person's active badge. Idempotent. Needs credentials:manage. */
export async function revokeBadgeAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) return failure(NO_CAMP);
  const personId = field(form, 'personId');
  if (!isUuid(personId)) return failure('That person is not valid.');

  try { await getRuntime().services.credentials.revoke(actor, personId); }
  catch (error) { return expectedFailure(error, 'Could not revoke the badge.'); }

  revalidatePath(personPath(personId));
  return success('Badge revoked.');
}

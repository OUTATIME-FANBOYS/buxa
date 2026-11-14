'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { personPath } from '@/config/routes';
import { failure } from '@/lib/actions/state';
import { getRuntime } from '@/server/runtime';
import { currentActor } from '../lib/camp';
import type { BadgeState } from '../lib/badgeState';
import { expectedFailure, NO_CAMP } from './failures';
import { field } from './parse';

/**
 * Issue a badge, or reissue one (which revokes the old badge). Returns the QR payload once; the token is not returned separately and
 * is never shown again. Needs credentials:manage.
 */
export async function issueBadgeAction(_previous: BadgeState, form: FormData): Promise<BadgeState> {
  const actor = await currentActor();
  if (!actor) return failure(NO_CAMP);
  const personId = field(form, 'personId');
  if (!isUuid(personId)) return failure('That person is not valid.');

  let badge;
  try { badge = await getRuntime().services.credentials.issue(actor, personId); }
  catch (error) { return expectedFailure(error, 'Could not issue the badge.'); }

  revalidatePath(personPath(personId));
  return { status: 'issued', payload: badge.payload };
}

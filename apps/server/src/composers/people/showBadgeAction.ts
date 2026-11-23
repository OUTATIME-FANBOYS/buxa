'use server';

import { isUuid } from '@buxa/domain';
import type { ShowBadgeState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { requireSession } from '../../session';
import { currentActor } from './camp';
import { NO_CAMP } from './failures';
import { showBadgeFailure, toShowBadgeState } from './badgeReveal';

/**
 * Shows the person's active badge: the QR payload, returned only to the caller who pressed Show. Allowed for admins and owners (any
 * person), for the person themself, and for a guardian of a child in the same household. Audited as badge.view. The service decides.
 */
export async function showBadgeAction(personId: string): Promise<ShowBadgeState> {
  if (!isUuid(personId)) {
    return { status: 'failed', message: 'That person is not valid.' };
  }
  const session = await requireSession();
  const actor = await currentActor();
  if (!actor) {
    return { status: 'failed', message: NO_CAMP };
  }

  try {
    return toShowBadgeState(await getRuntime().services.credentials.show(actor, personId, session.user.email));
  } catch (error) {
    return showBadgeFailure(error);
  }
}

/** Shows the same code again for a damaged card. Admins and owners only. Audited as badge.reprint. */
export async function reprintBadgeAction(personId: string): Promise<ShowBadgeState> {
  if (!isUuid(personId)) {
    return { status: 'failed', message: 'That person is not valid.' };
  }
  const actor = await currentActor();
  if (!actor) {
    return { status: 'failed', message: NO_CAMP };
  }

  try {
    return toShowBadgeState(await getRuntime().services.credentials.reprint(actor, personId));
  } catch (error) {
    return showBadgeFailure(error);
  }
}

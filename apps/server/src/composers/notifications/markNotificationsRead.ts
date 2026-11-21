'use server';

import { withOrg } from '@buxa/db';
import { isUuid } from '@buxa/domain';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { markNotificationsRead } from '../../notifications/notificationRows';

/**
 * Marks the signed-in person's notifications read: the given ids, or all of them when `ids` is null. Other people's rows are not
 * touched (row-level security). Ids that are not UUIDs are ignored.
 */
export async function markNotificationsReadAction(ids: readonly string[] | null): Promise<void> {
  const actor = await currentActor();
  if (!actor) {
    return;
  }
  const valid = ids === null ? null : ids.filter(isUuid);
  await withOrg(getRuntime().pool, actor.userId, actor.orgId, db => markNotificationsRead(db, valid));
}

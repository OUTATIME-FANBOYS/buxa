import 'server-only';
import { withOrg } from '@buxa/db';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { listNotificationRows, type NotificationRow } from '../../notifications/notificationRows';

/** The signed-in person's notifications (newest 50) and how many are unread. No camp: none. */
export async function loadNotifications(): Promise<{ rows: NotificationRow[]; unread: number }> {
  const actor = await currentActor();
  if (!actor) {
    return { rows: [], unread: 0 };
  }

  return withOrg(getRuntime().pool, actor.userId, actor.orgId, listNotificationRows);
}

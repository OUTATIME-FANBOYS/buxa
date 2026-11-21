'use server';

import { markNotificationsReadAction as markNotificationsReadImpl } from '@buxa/server/composers/notifications/markNotificationsRead';

// Server action wrapper for the notifications bell. Client components import this module, never @buxa/server.

export async function markNotificationsRead(ids: readonly string[] | null) {
  return markNotificationsReadImpl(ids);
}

'use server';

import { assignAction as assignActionImpl } from '@buxa/server/composers/groups/assignAction';
import { saveGroupAction as saveGroupActionImpl } from '@buxa/server/composers/groups/saveGroupAction';
import { saveRoomAction as saveRoomActionImpl } from '@buxa/server/composers/groups/saveRoomAction';

// Server action wrappers for the groups, rooms and assign screens. Client components import this module, never @buxa/server. Next.js
// allows only async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export async function saveGroupAction(...args: Parameters<typeof saveGroupActionImpl>) {
  return saveGroupActionImpl(...args);
}

export async function saveRoomAction(...args: Parameters<typeof saveRoomActionImpl>) {
  return saveRoomActionImpl(...args);
}

export async function assignAction(...args: Parameters<typeof assignActionImpl>) {
  return assignActionImpl(...args);
}

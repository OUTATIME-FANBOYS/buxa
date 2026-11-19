'use server';
import { updateProfileAction as updateProfileActionImpl } from '@buxa/server/composers/account/updateProfileAction';
import { updateTimeFormatAction as updateTimeFormatActionImpl } from '@buxa/server/composers/account/updateTimeFormatAction';

// Server action wrappers for the profile and the time format. Client components import this module, never @buxa/server. Next.js
// allows only async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export async function updateProfileAction(...args: Parameters<typeof updateProfileActionImpl>) {
  return updateProfileActionImpl(...args);
}

export async function updateTimeFormatAction(...args: Parameters<typeof updateTimeFormatActionImpl>) {
  return updateTimeFormatActionImpl(...args);
}

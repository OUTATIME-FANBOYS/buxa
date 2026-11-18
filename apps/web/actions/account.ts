'use server';
import { updateProfileAction as updateProfileActionImpl } from '@buxa/server/composers/account/updateProfileAction';

// Server action wrapper for the profile form. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so the action is wrapped rather than re-exported.

export async function updateProfileAction(...args: Parameters<typeof updateProfileActionImpl>) {
  return updateProfileActionImpl(...args);
}

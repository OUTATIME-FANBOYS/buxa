'use server';
import { setMemberOptionAction as setMemberOptionActionImpl } from '@buxa/server/composers/members/setMemberOptionAction';

// Server action wrapper for the team screen. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so the action is wrapped rather than re-exported.

export async function setMemberOptionAction(...args: Parameters<typeof setMemberOptionActionImpl>) {
  return setMemberOptionActionImpl(...args);
}

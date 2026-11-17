'use server';

import { checkInAction } from '@buxa/server/composers/attendance/checkIn';
import { checkOutAction } from '@buxa/server/composers/attendance/checkOut';
import { scanCodeAction } from '@buxa/server/composers/attendance/scanCode';
import { searchPeopleAction as searchPeopleActionImpl } from '@buxa/server/composers/attendance/searchPeople';

// The check-in and check-out server actions, as the client sees them. Client components import this module, never @buxa/server:
// the actions run on the server, and the hooks in @buxa/middleware receive them as arguments. Next.js allows only async functions
// to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export async function checkIn(input: unknown) {
  return checkInAction(input);
}

export async function checkOut(input: unknown) {
  return checkOutAction(input);
}

export async function scanCode(input: unknown) {
  return scanCodeAction(input);
}

export async function searchPeopleAction(...args: Parameters<typeof searchPeopleActionImpl>) {
  return searchPeopleActionImpl(...args);
}

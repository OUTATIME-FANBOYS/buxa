'use server';

import { checkInAction } from '@buxa/server/composers/attendance/checkIn';
import { checkOutAction } from '@buxa/server/composers/attendance/checkOut';
import { scanCodeAction } from '@buxa/server/composers/attendance/scanCode';
import { searchPeopleAction as searchPeopleActionImpl } from '@buxa/server/composers/attendance/searchPeople';
import { settle } from '@buxa/domain';

// The check-in and check-out server actions, as the client sees them. Client components import this module, never @buxa/server:
// the actions run on the server, and the hooks in @buxa/middleware receive them as arguments. Next.js allows only async functions
// to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export function checkIn(input: unknown) {
  return settle(() => {
    return checkInAction(input);
  });
}

export function checkOut(input: unknown) {
  return settle(() => {
    return checkOutAction(input);
  });
}

export function scanCode(input: unknown) {
  return settle(() => {
    return scanCodeAction(input);
  });
}

export function searchPeopleAction(...args: Parameters<typeof searchPeopleActionImpl>) {
  return settle(() => {
    return searchPeopleActionImpl(...args);
  });
}

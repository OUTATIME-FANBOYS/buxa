'use server';
import { addMembershipAction as addMembershipActionImpl } from '@buxa/server/composers/people/addMembershipAction';
import { archivePersonAction as archivePersonActionImpl } from '@buxa/server/composers/people/archivePersonAction';
import { issueBadgeAction as issueBadgeActionImpl } from '@buxa/server/composers/people/issueBadgeAction';
import { revokeBadgeAction as revokeBadgeActionImpl } from '@buxa/server/composers/people/revokeBadgeAction';
import {
  showBadgeAction as showBadgeActionImpl,
  reprintBadgeAction as reprintBadgeActionImpl,
} from '@buxa/server/composers/people/showBadgeAction';
import { updatePersonAction as updatePersonActionImpl } from '@buxa/server/composers/people/updatePersonAction';
import { linkHouseholdAction as linkHouseholdActionImpl } from '@buxa/server/composers/people/linkHouseholdAction';
import { createPersonAction as createPersonActionImpl } from '@buxa/server/composers/people/createPersonAction';
import { loadPersonAction as loadPersonActionImpl } from '@buxa/server/composers/people/loadPersonAction';
import { revokeMembershipAction as revokeMembershipActionImpl } from '@buxa/server/composers/people/revokeMembershipAction';
import { unlinkHouseholdAction as unlinkHouseholdActionImpl } from '@buxa/server/composers/people/unlinkHouseholdAction';
import { deletePeopleAction as deletePeopleActionImpl } from '@buxa/server/composers/people/deletePeopleAction';
import { updateEmergencyContactAction as updateEmergencyContactActionImpl } from '@buxa/server/composers/people/updateEmergencyContactAction';

// Server action wrappers for the people screens. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export async function addMembershipAction(...args: Parameters<typeof addMembershipActionImpl>) {
  return addMembershipActionImpl(...args);
}

export async function archivePersonAction(...args: Parameters<typeof archivePersonActionImpl>) {
  return archivePersonActionImpl(...args);
}

export async function issueBadgeAction(...args: Parameters<typeof issueBadgeActionImpl>) {
  return issueBadgeActionImpl(...args);
}

export async function revokeBadgeAction(...args: Parameters<typeof revokeBadgeActionImpl>) {
  return revokeBadgeActionImpl(...args);
}

export async function showBadgeAction(...args: Parameters<typeof showBadgeActionImpl>) {
  return showBadgeActionImpl(...args);
}

export async function reprintBadgeAction(...args: Parameters<typeof reprintBadgeActionImpl>) {
  return reprintBadgeActionImpl(...args);
}

export async function updatePersonAction(...args: Parameters<typeof updatePersonActionImpl>) {
  return updatePersonActionImpl(...args);
}

export async function linkHouseholdAction(...args: Parameters<typeof linkHouseholdActionImpl>) {
  return linkHouseholdActionImpl(...args);
}

export async function createPersonAction(...args: Parameters<typeof createPersonActionImpl>) {
  return createPersonActionImpl(...args);
}

export async function loadPersonAction(...args: Parameters<typeof loadPersonActionImpl>) {
  return loadPersonActionImpl(...args);
}

export async function revokeMembershipAction(...args: Parameters<typeof revokeMembershipActionImpl>) {
  return revokeMembershipActionImpl(...args);
}

export async function unlinkHouseholdAction(...args: Parameters<typeof unlinkHouseholdActionImpl>) {
  return unlinkHouseholdActionImpl(...args);
}

export async function deletePeopleAction(...args: Parameters<typeof deletePeopleActionImpl>) {
  return deletePeopleActionImpl(...args);
}

export async function updateEmergencyContactAction(...args: Parameters<typeof updateEmergencyContactActionImpl>) {
  return updateEmergencyContactActionImpl(...args);
}

/** What deleting people returns (the ids deleted and the ids refused). */
export type PeopleDeletion = Awaited<ReturnType<typeof deletePeopleActionImpl>>;

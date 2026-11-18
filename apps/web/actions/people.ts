'use server';
import { addMembershipAction as addMembershipActionImpl } from '@buxa/server/composers/people/addMembershipAction';
import { archivePersonAction as archivePersonActionImpl } from '@buxa/server/composers/people/archivePersonAction';
import { issueBadgeAction as issueBadgeActionImpl } from '@buxa/server/composers/people/issueBadgeAction';
import { revokeBadgeAction as revokeBadgeActionImpl } from '@buxa/server/composers/people/revokeBadgeAction';
import { updatePersonAction as updatePersonActionImpl } from '@buxa/server/composers/people/updatePersonAction';
import { linkHouseholdAction as linkHouseholdActionImpl } from '@buxa/server/composers/people/linkHouseholdAction';
import { createPersonAction as createPersonActionImpl } from '@buxa/server/composers/people/createPersonAction';
import { revokeMembershipAction as revokeMembershipActionImpl } from '@buxa/server/composers/people/revokeMembershipAction';
import { unlinkHouseholdAction as unlinkHouseholdActionImpl } from '@buxa/server/composers/people/unlinkHouseholdAction';
import { settle } from '@buxa/domain';

// Server action wrappers for the people screens. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export function addMembershipAction(...args: Parameters<typeof addMembershipActionImpl>) {
  return settle(() => {
    return addMembershipActionImpl(...args);
  });
}

export function archivePersonAction(...args: Parameters<typeof archivePersonActionImpl>) {
  return settle(() => {
    return archivePersonActionImpl(...args);
  });
}

export function issueBadgeAction(...args: Parameters<typeof issueBadgeActionImpl>) {
  return settle(() => {
    return issueBadgeActionImpl(...args);
  });
}

export function revokeBadgeAction(...args: Parameters<typeof revokeBadgeActionImpl>) {
  return settle(() => {
    return revokeBadgeActionImpl(...args);
  });
}

export function updatePersonAction(...args: Parameters<typeof updatePersonActionImpl>) {
  return settle(() => {
    return updatePersonActionImpl(...args);
  });
}

export function linkHouseholdAction(...args: Parameters<typeof linkHouseholdActionImpl>) {
  return settle(() => {
    return linkHouseholdActionImpl(...args);
  });
}

export function createPersonAction(...args: Parameters<typeof createPersonActionImpl>) {
  return settle(() => {
    return createPersonActionImpl(...args);
  });
}

export function revokeMembershipAction(...args: Parameters<typeof revokeMembershipActionImpl>) {
  return settle(() => {
    return revokeMembershipActionImpl(...args);
  });
}

export function unlinkHouseholdAction(...args: Parameters<typeof unlinkHouseholdActionImpl>) {
  return settle(() => {
    return unlinkHouseholdActionImpl(...args);
  });
}

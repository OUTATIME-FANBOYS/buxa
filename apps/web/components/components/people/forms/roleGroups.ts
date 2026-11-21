import { CAMP_ROLES, type CampRole } from '@buxa/domain';

/** A family role (a camper, a parent or guardian) is recorded with a household. Only membership of this set is decided here. */
const FAMILY_ROLES: ReadonlySet<CampRole> = new Set<CampRole>(['camper', 'guardian']);

export const isFamilyRole = (role: CampRole): boolean => FAMILY_ROLES.has(role);

/** The roles come from CAMP_ROLES (the domain's list, so the form and the domain cannot drift), in two headed groups. */
export const ROLE_GROUPS: readonly { heading: string; roles: readonly CampRole[] }[] = [
  { heading: 'Family', roles: CAMP_ROLES.filter(isFamilyRole) },
  { heading: 'Staff and participants', roles: CAMP_ROLES.filter(role => !isFamilyRole(role)) },
];

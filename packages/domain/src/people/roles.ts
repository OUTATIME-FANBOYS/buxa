import { PERSON_ROLE_KEYS, PERSON_ROLES, isPersonRole, type PersonRole } from '../roles/roles';

/**
 * What someone is at camp: the person roles. The keys, labels and priorities are defined once in ../roles/roles.ts; these are the
 * names the rest of the code has always used, derived from it so nothing is listed twice.
 */
export const CAMP_ROLES = PERSON_ROLE_KEYS;
export type CampRole = PersonRole;

export const CAMP_ROLE_LABELS: Readonly<Record<CampRole, string>> = Object.fromEntries(
  PERSON_ROLES.map(role => [role.key, role.label]),
) as Record<CampRole, string>;

export const isCampRole = isPersonRole;

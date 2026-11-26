import { PERSON_ROLES, type PersonRole } from '../roles/roles';

/**
 * The only role sets a person may hold, as sets: order does not matter. Every other combination is refused by the form and the
 * server actions. Staff roles (Admin staff, Organizer, Instructor, Participant) are one at a time; the only pairs are a family role
 * with one of the allowed extras.
 */
export const ALLOWED_ROLE_SETS: readonly (readonly PersonRole[])[] = [
  ['camper'],
  ['camper', 'participant'],
  ['guardian'],
  ['guardian', 'instructor'],
  ['guardian', 'organizer'],
  ['guardian', 'participant'],
  ['admin_staff'],
  ['instructor'],
  ['organizer'],
  ['participant'],
];

/** The staff hierarchy, highest first, from the role table in ../roles/roles.ts. Each person holds one staff role. */
export const STAFF_ROLE_ORDER: readonly PersonRole[] = PERSON_ROLES.filter(role => role.type === 'staff')
  .slice()
  .sort((a, b) => a.priority - b.priority)
  .map(role => role.key);

const sameSet = (a: ReadonlySet<PersonRole>, b: readonly PersonRole[]): boolean =>
  a.size === new Set(b).size && b.every(role => a.has(role));

/** Whether these roles, taken as a set (duplicates and order ignored), are one of the allowed sets. An empty list is not. */
export const isAllowedRoleSet = (roles: readonly PersonRole[]): boolean => {
  const set = new Set(roles);

  return set.size > 0 && ALLOWED_ROLE_SETS.some(allowed => sameSet(set, allowed));
};

/**
 * Whether a role's checkbox can be ticked, given the roles already chosen. A chosen role stays available so it can be unticked.
 * While the chosen set is itself not allowed (legacy data), nothing is blocked, so the person can change it to a valid set.
 */
export const isRoleAvailable = (chosen: readonly PersonRole[], role: PersonRole): boolean => {
  if (!isAllowedRoleSet(chosen)) {
    return true;
  }
  if (chosen.includes(role)) {
    return true;
  }

  return isAllowedRoleSet([...chosen, role]);
};

import type { CampRole } from './roles';

/**
 * The only role sets a person may hold, as sets: order does not matter. Every other combination is refused by the form and the
 * server actions. Staff roles (Admin staff, Organizer, Instructor, Participant) are one at a time; the only pairs are a family role
 * with one of the allowed extras.
 */
export const ALLOWED_ROLE_SETS: readonly (readonly CampRole[])[] = [
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

/**
 * Placeholder order of the staff roles, highest first. NOT CONFIRMED by the owner yet: it is not used by any rule or the form.
 * Kept here so the hierarchy has one home once the owner confirms it.
 */
export const STAFF_ROLE_ORDER_UNCONFIRMED: readonly CampRole[] = [
  'admin_staff',
  'organizer',
  'instructor',
  'participant',
];

const sameSet = (a: ReadonlySet<CampRole>, b: readonly CampRole[]): boolean =>
  a.size === new Set(b).size && b.every(role => a.has(role));

/** Whether these roles, taken as a set (duplicates and order ignored), are one of the allowed sets. An empty list is not. */
export const isAllowedRoleSet = (roles: readonly CampRole[]): boolean => {
  const set = new Set(roles);

  return set.size > 0 && ALLOWED_ROLE_SETS.some(allowed => sameSet(set, allowed));
};

/**
 * Whether a role's checkbox can be ticked, given the roles already chosen. A chosen role stays available so it can be unticked.
 * While the chosen set is itself not allowed (legacy data), nothing is blocked, so the person can change it to a valid set.
 */
export const isRoleAvailable = (chosen: readonly CampRole[], role: CampRole): boolean => {
  if (!isAllowedRoleSet(chosen)) {
    return true;
  }
  if (chosen.includes(role)) {
    return true;
  }

  return isAllowedRoleSet([...chosen, role]);
};

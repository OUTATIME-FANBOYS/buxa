/**
 * The one definition of every role key, label and priority in Buxa. Database values, permission checks and on-screen labels all
 * read from here. docs/ROLES.md is the agreed text: change it first, then this file.
 *
 * Three separate things, never one standing in for another:
 * - Users: every account that signs in.
 * - Organization access (ORG_ACCESS): what a signed-in user may do in one camp.
 * - Person roles (PERSON_ROLES): what a person is at camp. A person can hold several. They never change access.
 */

/** Organization access, highest first. `priority` 0 is the most powerful. */
export const ORG_ACCESS = [
  { key: 'owner', label: 'Owner', priority: 0 },
  { key: 'admin', label: 'Admin', priority: 1 },
  { key: 'staff', label: 'Staff', priority: 2 },
  { key: 'viewer', label: 'Viewer', priority: 3 },
] as const;
export type OrgAccess = (typeof ORG_ACCESS)[number]['key'];

/** Person roles, highest priority first. Staff roles rank above family roles; `type` says which side a role is on. */
export const PERSON_ROLES = [
  { key: 'admin_staff', label: 'Admin staff', type: 'staff', priority: 0 },
  { key: 'organizer', label: 'Organizer', type: 'staff', priority: 1 },
  { key: 'instructor', label: 'Instructor', type: 'staff', priority: 2 },
  { key: 'participant', label: 'Participant', type: 'staff', priority: 3 },
  { key: 'guardian', label: 'Parent or guardian', type: 'family', priority: 4 },
  { key: 'camper', label: 'Camper', type: 'family', priority: 5 },
] as const;
export type PersonRole = (typeof PERSON_ROLES)[number]['key'];
export type PersonRoleType = (typeof PERSON_ROLES)[number]['type'];

/** The keys as tuples, so zod's z.enum can take them directly. */
export const ORG_ACCESS_KEYS = ORG_ACCESS.map(role => role.key) as [OrgAccess, ...OrgAccess[]];
export const PERSON_ROLE_KEYS = PERSON_ROLES.map(role => role.key) as [PersonRole, ...PersonRole[]];

const personRoleDef = (role: PersonRole): (typeof PERSON_ROLES)[number] => {
  const def = PERSON_ROLES.find(r => r.key === role);
  if (!def) {
    throw new Error(`unknown person role: ${role}`);
  }

  return def;
};

const orgAccessDef = (access: OrgAccess): (typeof ORG_ACCESS)[number] => {
  const def = ORG_ACCESS.find(r => r.key === access);
  if (!def) {
    throw new Error(`unknown organization access: ${access}`);
  }

  return def;
};

export const orgAccessLabel = (access: OrgAccess): string => orgAccessDef(access).label;

export const orgAccessPriority = (access: OrgAccess): number => orgAccessDef(access).priority;

export const personRoleLabel = (role: PersonRole): string => personRoleDef(role).label;

export const personRolePriority = (role: PersonRole): number => personRoleDef(role).priority;

export const isOrgAccess = (value: unknown): value is OrgAccess =>
  typeof value === 'string' && (ORG_ACCESS_KEYS as readonly string[]).includes(value);

export const isPersonRole = (value: unknown): value is PersonRole =>
  typeof value === 'string' && (PERSON_ROLE_KEYS as readonly string[]).includes(value);

/** Staff roles (Admin staff, Organizer, Instructor, Participant) run the camp; family roles (Guardian, Camper) are the family side. */
export const isStaffRole = (role: PersonRole): boolean => personRoleDef(role).type === 'staff';

/** Only an instructor can be assigned to a class. The class picker lists people with this role and no other. */
export const isAssignableToClass = (role: PersonRole): boolean => role === 'instructor';

/**
 * The role a person is shown as: the highest staff role they hold, else the highest family role (Guardian over Camper). Null when
 * they hold none. A camper and a guardian show Guardian; an instructor and a participant show Instructor.
 */
export const primaryPersonRole = (roles: readonly PersonRole[]): PersonRole | null => {
  const highest = (candidates: readonly PersonRole[]): PersonRole | null =>
    candidates.reduce<PersonRole | null>(
      (top, role) => (top === null || personRolePriority(role) < personRolePriority(top) ? role : top),
      null,
    );

  return highest(roles.filter(isStaffRole)) ?? highest(roles.filter(role => !isStaffRole(role)));
};

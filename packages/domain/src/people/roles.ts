/**
 * What someone *is* at camp. Not the same as the permission roles in ../permissions (viewer, staff, admin, owner), which decide
 * what a signed-in user may do. A person can hold several camp roles (a guardian who also instructs).
 */
export const CAMP_ROLES = ['camper', 'participant', 'guardian', 'instructor', 'organizer', 'admin_staff'] as const;
export type CampRole = (typeof CAMP_ROLES)[number];

export const CAMP_ROLE_LABELS: Readonly<Record<CampRole, string>> = {
  camper: 'Camper',
  participant: 'Participant',
  guardian: 'Parent or guardian',
  instructor: 'Instructor',
  organizer: 'Organizer',
  admin_staff: 'Admin staff',
};

export const isCampRole = (value: unknown): value is CampRole => typeof value === 'string' && (CAMP_ROLES as readonly string[]).includes(value);

import type { CampRole } from '@buxa/domain';

export const CHOOSE_ROLE = 'Choose at least one role.';
export const CAMPER_NEEDS_GUARDIAN = 'A camper needs a household that has a parent or guardian.';
export const RELATIONSHIP_NEEDED = 'Say how they are related.';
export const PICKUP_NEEDS_GUARDIAN = 'Only a guardian can be authorised to collect a child.';

/**
 * Whether a person joining a household is its guardian. No rule in @buxa/domain says this yet, so it is inferred from the role:
 * the `guardian` role makes someone a guardian of the households they join. Other adult roles (instructor, organizer,
 * admin_staff) do not. An admin can still change the flags per link through `linkToHousehold`.
 */
export const isGuardianRole = (roles: readonly CampRole[]): boolean => roles.includes('guardian');

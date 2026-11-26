import { CAMP_ROLE_LABELS } from '@buxa/domain';
import type { HouseholdMember } from '@buxa/contracts';

/**
 * A member's role in a household, as one word. A camper is the Child; a guardian is the Guardian; otherwise the relationship the
 * household wrote down. Viewers get no relationship or guardian flag, so they see the camp role instead.
 */
export function householdRoleLabel(member: Pick<HouseholdMember, 'roles' | 'isGuardian' | 'relationship'>): string {
  if (member.roles.includes('camper')) {
    return 'Child';
  }
  if (member.isGuardian) {
    return 'Guardian';
  }
  if (member.relationship) {
    return member.relationship;
  }

  return member.roles.map(role => CAMP_ROLE_LABELS[role]).join(', ') || 'Member';
}

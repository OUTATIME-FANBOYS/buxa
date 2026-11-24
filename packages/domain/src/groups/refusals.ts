import type { AssignmentRefusal } from './assignment';
import { formatDay } from './days';

/** The camp roles that count as staff for a group's ratio. A staff member placed in a group is one of these. */
export const STAFF_ROLES = ['instructor', 'organizer', 'admin_staff'] as const;

/**
 * The words a person reads when an assignment is refused. One source for the server's outcome and the screens. Short and polite:
 * each line says what is wrong and, where there is one, the next step.
 */
export function describeAssignmentRefusal(r: AssignmentRefusal): string {
  switch (r.reason) {
    case 'override_needs_reason':
      return 'Give a reason for overriding the ratio.';
    case 'override_not_allowed':
      return 'Only an admin can override the ratio.';
    case 'role_missing':
      return r.role === 'staff'
        ? 'This person is not marked as staff, so they cannot be placed as staff.'
        : 'This person is not a camper, so they cannot be placed in a group.';
    case 'group_full':
      return `This group is full (${r.capacity} campers). Move someone out, or choose another group.`;
    case 'age_unknown':
      return "Add this camper's date of birth before placing them, so their age can be checked.";
    case 'age_out_of_range':
      return `This group is for ages ${r.range.minAge} to ${r.range.maxAge}. The camper is ${r.age} on the first day of the session.`;
    case 'room_overlap':
      return `This room is in use by ${r.clash.label} (${formatDay(r.clash.startsOn)} to ${formatDay(r.clash.endsOn)}) on some of the same days.`;
    case 'room_full':
      return `This room is full (${r.capacity} campers). Choose another room.`;
    case 'ratio':
      return `This group would have ${r.campers} campers for ${r.staff} staff. Its ratio is 1 staff to ${r.ratioCampers} campers. An admin can override it with a reason.`;
  }
}

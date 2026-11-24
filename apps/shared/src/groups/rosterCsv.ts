import { suggestSlug, type AssignRole, type Roster } from '@buxa/domain';
import { encodeCsv } from '../csv';

/** The columns of the roster CSV: one row per person placed in the session. */
export const ROSTER_CSV_HEADER = ['Group', 'Room', 'Name', 'Role'] as const;

const ROLE_LABEL: Record<AssignRole, string> = { camper: 'Camper', staff: 'Staff' };

/**
 * The roster as CSV rows (CRLF, RFC 4180). Every text cell goes through `encodeCsv`, so a name or group that starts with a formula
 * character is neutralised. The byte-order mark is added by the route, as for the attendance export.
 */
export function rosterCsv(roster: Roster): string {
  const rows = roster.groups.flatMap(group =>
    group.rooms.flatMap(room =>
      room.members.map(member => [group.name, room.name, member.name, ROLE_LABEL[member.role]] as const),
    ),
  );

  return encodeCsv([ROSTER_CSV_HEADER, ...rows]);
}

/** The download's file name for a session: `roster-<session-name>.csv`, with a fallback when the name has no usable letters. */
export function rosterFileName(sessionName: string): string {
  return `roster-${suggestSlug(sessionName) || 'session'}.csv`;
}

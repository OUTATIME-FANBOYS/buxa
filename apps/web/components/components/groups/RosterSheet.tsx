import type { ReactNode } from 'react';
import type { Roster, RosterMember, RosterGroup } from '@buxa/domain';

/** The label for a role on the roster: "Camper" or "Staff". */
const ROLE_LABEL: Record<RosterMember['role'], string> = { camper: 'Camper', staff: 'Staff' };

/** The people placed in a group, across all of its rooms. A group with none is shown as empty. */
function membersOf(group: RosterGroup): RosterMember[] {
  return group.rooms.flatMap(room => room.members);
}

/**
 * A session's roster as plain print-ready sections. The title block (the roster name and the session dates) sits beside the
 * `actions` (the Print button), on one row. Then each group is a section headed by its name, and each of its rooms is a muted
 * sub-line over a table of names and roles. A group with no one placed says so instead of drawing an empty table.
 * Presentational only: the page loads the roster, this draws it.
 */
export function RosterSheet({
  sessionName,
  dates,
  roster,
  actions,
}: {
  sessionName: string;
  dates: string;
  roster: Roster;
  actions?: ReactNode;
}) {
  return (
    <article className="roster-sheet">
      <header className="roster-sheet-head">
        <div className="roster-sheet-title">
          <h1>Roster: {sessionName}</h1>
          <p className="muted">{dates}</p>
        </div>
        {actions}
      </header>
      {roster.groups.length === 0 && <p className="muted">No one is placed in this session yet.</p>}
      {roster.groups.map(group => (
        <section key={group.id} className="roster-group" aria-labelledby={`roster-group-${group.id}`}>
          <h2 id={`roster-group-${group.id}`}>{group.name}</h2>
          {membersOf(group).length === 0 && <p className="muted">No campers placed in this group yet</p>}
          {membersOf(group).length > 0 &&
            group.rooms.map(room => (
              <section key={room.id} className="roster-room" aria-label={`${group.name}, ${room.name}`}>
                <p className="roster-room-name muted">{room.name}</p>
                <table className="table roster-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.members.map(member => (
                      <tr key={member.personId}>
                        <td>{member.name}</td>
                        <td>{ROLE_LABEL[member.role]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
        </section>
      ))}
    </article>
  );
}

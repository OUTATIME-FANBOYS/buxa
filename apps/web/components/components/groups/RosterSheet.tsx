import type { Roster, RosterMember } from '@buxa/domain';

/** The label for a role on the roster: "Camper" or "Staff". */
const ROLE_LABEL: Record<RosterMember['role'], string> = { camper: 'Camper', staff: 'Staff' };

/**
 * A session's roster as plain print-ready sections: each group, then each of its rooms as a table of names and roles. Presentational
 * only: the page loads the roster, this draws it. Empty groups and rooms are not in the roster, so none are drawn.
 */
export function RosterSheet({ sessionName, dates, roster }: { sessionName: string; dates: string; roster: Roster }) {
  return (
    <article className="roster-sheet">
      <header className="roster-sheet-head">
        <h1>Roster: {sessionName}</h1>
        <p>{dates}</p>
      </header>
      {roster.groups.length === 0 && <p>No one is placed in this session yet.</p>}
      {roster.groups.map(group => (
        <section key={group.id} className="roster-group" aria-labelledby={`roster-group-${group.id}`}>
          <h2 id={`roster-group-${group.id}`}>{group.name}</h2>
          {group.rooms.map(room => (
            <section key={room.id} className="roster-room" aria-label={`${group.name}, ${room.name}`}>
              <h3>{room.name}</h3>
              <table className="roster-table">
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

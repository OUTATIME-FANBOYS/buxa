import type { Group, Room } from '@buxa/contracts';
import { GroupDialog } from './GroupDialog';
import { RoomDialog } from './RoomDialog';

/** "5 to 8", "from 8", or "Any age". */
export function ageText(group: Pick<Group, 'ageRange'>): string {
  if (!group.ageRange) {
    return 'Any age';
  }

  return `${group.ageRange.minAge} to ${group.ageRange.maxAge}`;
}

/** "1:8", or "No ratio". */
export function ratioText(group: Pick<Group, 'ratioCampers'>): string {
  return group.ratioCampers === null ? 'No ratio' : `1:${group.ratioCampers}`;
}

/** The session's groups with their capacity, staff and ratio. Staff who can change them get an Edit button on each row. */
export function GroupsTable({
  sessionId,
  groups,
  canManage,
}: {
  sessionId: string;
  groups: readonly Group[];
  canManage: boolean;
}) {
  if (groups.length === 0) {
    return <p className="muted">No groups yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Groups in this session</caption>
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col">Ages</th>
            <th scope="col">Campers</th>
            <th scope="col">Staff</th>
            <th scope="col">Ratio</th>
            {canManage && (
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <tr key={g.id}>
              <th scope="row">{g.name}</th>
              <td>{ageText(g)}</td>
              <td>
                {g.campers} of {g.capacity}
              </td>
              <td>{g.staff}</td>
              <td>{ratioText(g)}</td>
              {canManage && (
                <td>
                  <GroupDialog sessionId={sessionId} group={g} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The session's rooms with their location and how many campers each holds. */
export function RoomsTable({
  sessionId,
  rooms,
  canManage,
}: {
  sessionId: string;
  rooms: readonly Room[];
  canManage: boolean;
}) {
  if (rooms.length === 0) {
    return <p className="muted">No rooms yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Rooms booked for this session</caption>
        <thead>
          <tr>
            <th scope="col">Room</th>
            <th scope="col">Location</th>
            <th scope="col">Campers</th>
            {canManage && (
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rooms.map(r => (
            <tr key={r.id}>
              <th scope="row">{r.name}</th>
              <td>{r.location}</td>
              <td>
                {r.campers} of {r.capacity}
              </td>
              {canManage && (
                <td>
                  <RoomDialog sessionId={sessionId} room={r} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

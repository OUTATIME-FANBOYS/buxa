import type { Assignment, Group, Room } from '@buxa/contracts';
import { ratioText } from './GroupsTable';
import { UnassignButton } from './UnassignButton';

export interface BoardPerson {
  id: string;
  name: string;
}

/**
 * Each group with the people placed in it and their room, then the campers not placed yet. Read-only; the Place or move button on the
 * page is what changes it. A ratio override is shown under the person it applies to, with its reason.
 */
export function AssignBoard({
  sessionId,
  canManage,
  groups,
  rooms,
  assignments,
  unplaced,
}: {
  sessionId: string;
  /** True when the viewer may place or move people (classes:manage). Only then is each member's Unassign button shown. */
  canManage: boolean;
  groups: readonly Group[];
  rooms: readonly Room[];
  assignments: readonly Assignment[];
  unplaced: readonly BoardPerson[];
}) {
  const roomName = (id: string): string => rooms.find(r => r.id === id)?.name ?? 'Unknown room';

  return (
    <div className="stack">
      {groups.length === 0 && (
        <p className="muted">No groups yet. Create a group on the Groups and rooms page first.</p>
      )}
      {groups.map(group => {
        const members = assignments.filter(a => a.groupId === group.id);

        return (
          <section key={group.id} className="panel stack" aria-labelledby={`group-${group.id}`}>
            <h2 id={`group-${group.id}`} className="people-subheading">
              {group.name}
            </h2>
            <p className="muted">
              {group.campers} of {group.capacity} campers, {group.staff} staff, ratio {ratioText(group)}
            </p>
            {members.length === 0 ? (
              <p className="muted">No one placed here yet.</p>
            ) : (
              <ul className="stack" aria-label={`People in ${group.name}`}>
                {members.map(a => (
                  <li key={a.id}>
                    <strong>{a.personName}</strong>{' '}
                    <span className="muted">
                      {a.role === 'staff' ? 'Staff' : 'Camper'}, {roomName(a.roomId)}
                    </span>
                    {a.overrideReason && <p className="muted">Ratio overridden: {a.overrideReason}</p>}
                    {canManage && (
                      <UnassignButton
                        sessionId={sessionId}
                        personId={a.personId}
                        personName={a.personName}
                        groupName={group.name}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <section className="panel stack" aria-labelledby="unplaced-heading">
        <h2 id="unplaced-heading" className="people-subheading">
          Campers not placed yet
        </h2>
        {unplaced.length === 0 ? (
          <p className="muted">Every camper is placed.</p>
        ) : (
          <ul className="stack">
            {unplaced.map(p => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import type { Assignment, Group, Room } from '@buxa/contracts';
import { ratioText } from './GroupsTable';
import { UnassignButton } from './UnassignButton';
import type { AssignChoices } from './AssignDialog';
import { UnplacedCampers } from './UnplacedCampers';

export interface BoardPerson {
  id: string;
  name: string;
}

/**
 * Each group as a table of the people placed in it: name, role and room, and (for staff) the Unassign icon at the right end of the
 * row. The campers not placed yet sit beside them: a 60/40 split on a desktop, stacked on a phone. The Place button in that card's
 * header is what adds people. A ratio override is shown under the person it applies to, with its reason.
 */
export function AssignBoard({
  sessionId,
  canManage,
  groups,
  rooms,
  assignments,
  unplaced,
  choices,
}: {
  sessionId: string;
  /** True when the viewer may place or move people (classes:manage). Only then is each member's Unassign button shown. */
  canManage: boolean;
  groups: readonly Group[];
  rooms: readonly Room[];
  assignments: readonly Assignment[];
  unplaced: readonly BoardPerson[];
  /** Given only to people who may place: it turns on the Place button in the campers not placed yet card's header. */
  choices?: AssignChoices;
}) {
  const roomName = (id: string): string => rooms.find(r => r.id === id)?.name ?? 'Unknown room';

  return (
    <div className="assign-layout">
      <div className="stack assign-layout__groups">
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
                <div className="table-wrap">
                  <table className="table assign-table">
                    <caption className="sr-only">People in {group.name}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Person</th>
                        <th scope="col">Role and room</th>
                        {canManage && (
                          <th scope="col">
                            <span className="sr-only">Actions</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(a => (
                        <tr key={a.id}>
                          <th scope="row" className="assign-table__name">
                            {a.personName}
                            {a.overrideReason && <span className="muted">Ratio overridden: {a.overrideReason}</span>}
                          </th>
                          <td>
                            {a.role === 'staff' ? 'Staff' : 'Camper'}, {roomName(a.roomId)}
                          </td>
                          {canManage && (
                            <td className="classes-actions-cell">
                              <div className="classes-row-actions">
                                <UnassignButton
                                  sessionId={sessionId}
                                  personId={a.personId}
                                  personName={a.personName}
                                  groupName={group.name}
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="assign-layout__unplaced">
        <UnplacedCampers people={unplaced} choices={choices} />
      </div>
    </div>
  );
}

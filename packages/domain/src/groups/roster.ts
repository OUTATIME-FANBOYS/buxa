import type { AssignRole } from './assignment';

/** A group as the roster reads it: its id and name. */
export interface RosterGroupSource {
  id: string;
  name: string;
}

/** A room as the roster reads it: its id and name. */
export interface RosterRoomSource {
  id: string;
  name: string;
}

/** One placement in the session: a person, their role, and the group and room they are placed in. */
export interface RosterPlacementSource {
  personId: string;
  personName: string;
  role: AssignRole;
  groupId: string;
  roomId: string;
}

export interface RosterMember {
  personId: string;
  name: string;
  role: AssignRole;
}

export interface RosterRoom {
  id: string;
  name: string;
  /** The people placed in this room for this group, sorted by name. */
  members: RosterMember[];
}

export interface RosterGroup {
  id: string;
  name: string;
  /** The rooms this group uses, sorted by name. Only rooms with someone placed in them appear. */
  rooms: RosterRoom[];
}

/** A session's roster: the groups with people in them, each with its rooms and members. */
export interface Roster {
  groups: RosterGroup[];
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Names in a stable order: by name, then by id so two people with the same name keep a fixed place. */
function byName(a: { name: string; id: string }, b: { name: string; id: string }): number {
  return collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Builds a session's roster from its groups, rooms and placements. Groups sort by name, then each group's rooms by name, then each
 * room's members by name. A group or room with nobody placed in it is left out; a placement that names an unknown group or room is
 * skipped. Pure: the screens and the exports both build the roster here, so they show the same people.
 */
export function buildRoster(
  groups: readonly RosterGroupSource[],
  rooms: readonly RosterRoomSource[],
  placements: readonly RosterPlacementSource[],
): Roster {
  const groupById = new Map(groups.map(group => [group.id, group]));
  const roomById = new Map(rooms.map(room => [room.id, room]));
  const groupsOut = new Map<string, RosterGroup>();
  const roomsOut = new Map<string, RosterRoom>();

  for (const placement of placements) {
    const group = groupById.get(placement.groupId);
    const room = roomById.get(placement.roomId);
    if (!group || !room) {
      continue;
    }
    const roomKey = `${group.id}\u0000${room.id}`;
    let rosterRoom = roomsOut.get(roomKey);
    if (!rosterRoom) {
      rosterRoom = { id: room.id, name: room.name, members: [] };
      roomsOut.set(roomKey, rosterRoom);
      const rosterGroup = groupsOut.get(group.id) ?? { id: group.id, name: group.name, rooms: [] };
      groupsOut.set(group.id, rosterGroup);
      rosterGroup.rooms.push(rosterRoom);
    }
    rosterRoom.members.push({ personId: placement.personId, name: placement.personName, role: placement.role });
  }

  const sortedGroups = [...groupsOut.values()].sort(byName);
  for (const group of sortedGroups) {
    group.rooms.sort(byName);
    for (const room of group.rooms) {
      room.members.sort((a, b) => byName({ name: a.name, id: a.personId }, { name: b.name, id: b.personId }));
    }
  }

  return { groups: sortedGroups };
}

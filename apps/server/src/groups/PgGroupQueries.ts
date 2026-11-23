import type { Assignment, Group, Room } from '@buxa/contracts';
import type { AgeRange } from '@buxa/domain';
import type { Db } from '../people/pgRows';
import { GroupNotFoundError, RoomNotFoundError, SessionNotFoundError } from './errors';

/*
 * Reads and locks for groups, rooms and assignments. Every query runs inside withOrg, so row-level security hides another
 * camp's rows. These functions never write; the writes are in PgGroupWrites.ts and PgAssign.ts.
 */

interface GroupRow {
  id: string;
  session_id: string;
  name: string;
  capacity: number;
  ratio_campers: number | null;
  age_min: number | null;
  age_max: number | null;
  campers: number;
  staff: number;
}

interface RoomRow {
  id: string;
  session_id: string;
  name: string;
  location: string;
  capacity: number;
  campers: number;
}

interface AssignmentRow {
  id: string;
  session_id: string;
  person_id: string;
  person_name: string;
  role: 'camper' | 'staff';
  group_id: string;
  room_id: string;
  ratio_override_reason: string | null;
}

/** Both bounds are set by the contract, so a missing one (an old row) is widened to the limits rather than dropped. */
export function ageRangeOf(min: number | null, max: number | null): AgeRange | null {
  if (min === null && max === null) {
    return null;
  }

  return { minAge: min ?? 0, maxAge: max ?? 120 };
}

const groupFromRow = (row: GroupRow): Group => ({
  id: row.id,
  sessionId: row.session_id,
  name: row.name,
  capacity: row.capacity,
  ratioCampers: row.ratio_campers,
  ageRange: ageRangeOf(row.age_min, row.age_max),
  campers: row.campers,
  staff: row.staff,
});

const roomFromRow = (row: RoomRow): Room => ({
  id: row.id,
  sessionId: row.session_id,
  name: row.name,
  location: row.location,
  capacity: row.capacity,
  campers: row.campers,
});

const assignmentFromRow = (row: AssignmentRow): Assignment => ({
  id: row.id,
  sessionId: row.session_id,
  personId: row.person_id,
  personName: row.person_name,
  role: row.role,
  groupId: row.group_id,
  roomId: row.room_id,
  overrideReason: row.ratio_override_reason,
});

/** Throws SessionNotFoundError when the session is not in this camp. */
export async function requireSessionRow(db: Db, sessionId: string): Promise<void> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM classes WHERE id = $1`, [sessionId]);
  if (rows.length === 0) {
    throw new SessionNotFoundError();
  }
}

export async function listGroupRows(db: Db, sessionId: string): Promise<Group[]> {
  await requireSessionRow(db, sessionId);
  const { rows } = await db.query<GroupRow>(
    `SELECT g.id, g.session_id, g.name, g.capacity, g.ratio_campers, g.age_min, g.age_max,
            (SELECT count(*)::int FROM assignments a WHERE a.group_id = g.id AND a.active AND a.role = 'camper') AS campers,
            (SELECT count(*)::int FROM assignments a WHERE a.group_id = g.id AND a.active AND a.role = 'staff') AS staff
       FROM groups g
      WHERE g.session_id = $1
      ORDER BY lower(g.name), g.id`,
    [sessionId],
  );

  return rows.map(groupFromRow);
}

export async function listRoomRows(db: Db, sessionId: string): Promise<Room[]> {
  await requireSessionRow(db, sessionId);
  const { rows } = await db.query<RoomRow>(
    `SELECT r.id, r.session_id, r.name, r.location, r.capacity,
            (SELECT count(*)::int FROM assignments a WHERE a.room_id = r.id AND a.active AND a.role = 'camper') AS campers
       FROM rooms r
      WHERE r.session_id = $1
      ORDER BY lower(r.name), r.id`,
    [sessionId],
  );

  return rows.map(roomFromRow);
}

export async function listAssignmentRows(db: Db, sessionId: string): Promise<Assignment[]> {
  await requireSessionRow(db, sessionId);
  const { rows } = await db.query<AssignmentRow>(
    `SELECT a.id, a.session_id, a.person_id, p.given_name || ' ' || p.family_name AS person_name, a.role,
            a.group_id, a.room_id, a.ratio_override_reason
       FROM assignments a
       JOIN people p ON p.id = a.person_id
      WHERE a.session_id = $1 AND a.active
      ORDER BY lower(p.family_name), lower(p.given_name), a.id`,
    [sessionId],
  );

  return rows.map(assignmentFromRow);
}

/** One group as the page reads it, after a write. Throws GroupNotFoundError. */
export async function requireGroup(db: Db, groupId: string): Promise<Group> {
  const { rows } = await db.query<GroupRow>(
    `SELECT g.id, g.session_id, g.name, g.capacity, g.ratio_campers, g.age_min, g.age_max,
            (SELECT count(*)::int FROM assignments a WHERE a.group_id = g.id AND a.active AND a.role = 'camper') AS campers,
            (SELECT count(*)::int FROM assignments a WHERE a.group_id = g.id AND a.active AND a.role = 'staff') AS staff
       FROM groups g WHERE g.id = $1`,
    [groupId],
  );
  if (rows.length === 0) {
    throw new GroupNotFoundError();
  }

  return groupFromRow(rows[0]);
}

/** One room as the page reads it, after a write. Throws RoomNotFoundError. */
export async function requireRoom(db: Db, roomId: string): Promise<Room> {
  const { rows } = await db.query<RoomRow>(
    `SELECT r.id, r.session_id, r.name, r.location, r.capacity,
            (SELECT count(*)::int FROM assignments a WHERE a.room_id = r.id AND a.active AND a.role = 'camper') AS campers
       FROM rooms r WHERE r.id = $1`,
    [roomId],
  );
  if (rows.length === 0) {
    throw new RoomNotFoundError();
  }

  return roomFromRow(rows[0]);
}

/** One assignment as the page reads it, after a write. */
export async function requireAssignment(db: Db, assignmentId: string): Promise<Assignment> {
  const { rows } = await db.query<AssignmentRow>(
    `SELECT a.id, a.session_id, a.person_id, p.given_name || ' ' || p.family_name AS person_name, a.role,
            a.group_id, a.room_id, a.ratio_override_reason
       FROM assignments a JOIN people p ON p.id = a.person_id WHERE a.id = $1`,
    [assignmentId],
  );

  return assignmentFromRow(rows[0]);
}

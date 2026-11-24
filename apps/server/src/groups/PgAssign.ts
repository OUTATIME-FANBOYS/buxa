import { isUniqueViolation } from '@buxa/db';
import { STAFF_ROLES, type Actor, type AssignRole, type AssignmentFacts } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import type { Db } from '../people/pgRows';
import type { AssignRequest, AssignmentRule } from './GroupRepository';
import {
  AssignmentConflictError,
  AssignmentRefusedError,
  GroupNotFoundError,
  PersonNotFoundError,
  RoomNotFoundError,
  SessionUndatedError,
} from './errors';
import { ageRangeOf, requireSessionRow } from './PgGroupQueries';

/*
 * The placement write. Runs inside the caller's transaction (withOrg). Locks are taken in one fixed order, everywhere:
 *   1. the person's row (so one person is placed by one transaction at a time),
 *   2. the group's row (so two placements into the last place run one after the other, and the count that follows sees the
 *      other one committed),
 *   3. the room's row, then a lock on the room's name and location for the whole camp (so two sessions that share a day cannot
 *      both book the same physical room at once; each session has its own room rows, and the lock is what joins them).
 * Under READ COMMITTED each count is a fresh statement, so after the locks it sees every committed placement.
 */

interface PersonLock {
  dateOfBirth: string | null;
  holdsRole: boolean;
}

interface GroupLock {
  capacity: number;
  ratioCampers: number | null;
  ageMin: number | null;
  ageMax: number | null;
  startsOn: string;
  endsOn: string;
}

interface RoomLock {
  capacity: number;
  name: string;
  location: string;
}

export interface CurrentPlacement {
  id: string;
  groupId: string;
  roomId: string;
  role: AssignRole;
  overrideReason: string | null;
}

/** The roles that may be placed: a camper placed as a camper; a staff member placed as one of the staff roles. */
const rolesFor = (role: AssignRole): string[] => (role === 'staff' ? [...STAFF_ROLES] : ['camper']);

async function lockPerson(db: Db, personId: string, role: AssignRole): Promise<PersonLock> {
  const { rows } = await db.query<{ date_of_birth: string | null; holds: boolean }>(
    `SELECT to_char(p.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
            EXISTS (SELECT 1 FROM person_roles r WHERE r.person_id = p.id AND r.role = ANY($2::text[])) AS holds
       FROM people p WHERE p.id = $1 FOR UPDATE OF p`,
    [personId, rolesFor(role)],
  );
  if (rows.length === 0) {
    throw new PersonNotFoundError();
  }

  return { dateOfBirth: rows[0].date_of_birth, holdsRole: rows[0].holds };
}

async function lockGroup(db: Db, groupId: string, sessionId: string): Promise<GroupLock> {
  const { rows } = await db.query<{
    capacity: number;
    ratio_campers: number | null;
    age_min: number | null;
    age_max: number | null;
    starts_on: string | null;
    ends_on: string | null;
  }>(
    `SELECT g.capacity, g.ratio_campers, g.age_min, g.age_max,
            to_char(c.starts_on, 'YYYY-MM-DD') AS starts_on, to_char(c.ends_on, 'YYYY-MM-DD') AS ends_on
       FROM groups g JOIN classes c ON c.id = g.session_id AND c.org_id = g.org_id
      WHERE g.id = $1 AND g.session_id = $2 FOR UPDATE OF g`,
    [groupId, sessionId],
  );
  const row = rows[0];
  if (!row) {
    throw new GroupNotFoundError();
  }
  if (row.starts_on === null || row.ends_on === null) {
    throw new SessionUndatedError();
  }

  return {
    capacity: row.capacity,
    ratioCampers: row.ratio_campers,
    ageMin: row.age_min,
    ageMax: row.age_max,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  };
}

export async function lockRoom(db: Db, orgId: string, roomId: string, sessionId: string): Promise<RoomLock> {
  const { rows } = await db.query<RoomLock>(
    `SELECT capacity, name, location FROM rooms WHERE id = $1 AND session_id = $2 FOR UPDATE`,
    [roomId, sessionId],
  );
  const row = rows[0];
  if (!row) {
    throw new RoomNotFoundError();
  }
  // The room is the same physical space in every session that books it, so placements into it are serialised by name and place.
  await db.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    `${orgId}:room:${row.name.toLowerCase()}:${row.location.toLowerCase()}`,
  ]);

  return row;
}

export async function currentPlacement(db: Db, sessionId: string, personId: string): Promise<CurrentPlacement | null> {
  const { rows } = await db.query<{
    id: string;
    group_id: string;
    room_id: string;
    role: AssignRole;
    ratio_override_reason: string | null;
  }>(
    `SELECT id, group_id, room_id, role, ratio_override_reason FROM assignments
      WHERE session_id = $1 AND person_id = $2 AND active FOR UPDATE`,
    [sessionId, personId],
  );
  const row = rows[0];

  return row
    ? {
        id: row.id,
        groupId: row.group_id,
        roomId: row.room_id,
        role: row.role,
        overrideReason: row.ratio_override_reason,
      }
    : null;
}

/** Places a person in a group and room for a session, or moves their placement in that session. Returns the assignment's id. */
export async function assignInTransaction(
  db: Db,
  actor: Actor,
  request: AssignRequest,
  rule: AssignmentRule,
): Promise<string> {
  await requireSessionRow(db, request.sessionId);
  const person = await lockPerson(db, request.personId, request.role);
  const group = await lockGroup(db, request.groupId, request.sessionId);
  const room = await lockRoom(db, actor.orgId, request.roomId, request.sessionId);
  const current = await currentPlacement(db, request.sessionId, request.personId);

  const decision = rule(await gatherFacts(db, request, { person, group, room }));
  if (decision.kind === 'refuse') {
    throw new AssignmentRefusedError(decision);
  }

  const overrideReason = decision.overrode?.reason ?? null;
  const id = current
    ? await moveOrKeep(db, actor, request, current, overrideReason)
    : await insertPlacement(db, actor, request, overrideReason);
  if (decision.overrode) {
    await recordAudit(db, {
      actor,
      action: 'assignment.override',
      entity: 'assignment',
      entityId: id,
      data: {
        sessionId: request.sessionId,
        personId: request.personId,
        groupId: request.groupId,
        reason: decision.overrode.reason,
        campers: decision.overrode.campers,
        staff: decision.overrode.staff,
        ratioCampers: decision.overrode.ratioCampers,
      },
    });
  }

  return id;
}

/** The facts the rule reads, from the locked rows and fresh counts. Counts exclude the person being placed. */
async function gatherFacts(
  db: Db,
  request: AssignRequest,
  locked: { person: PersonLock; group: GroupLock; room: RoomLock },
): Promise<AssignmentFacts> {
  const { rows: counts } = await db.query<{ campers: number; staff: number }>(
    `SELECT count(*) FILTER (WHERE role = 'camper')::int AS campers,
            count(*) FILTER (WHERE role = 'staff')::int AS staff
       FROM assignments WHERE group_id = $1 AND active AND person_id <> $2`,
    [request.groupId, request.personId],
  );
  const { rows: roomRows } = await db.query<{ campers: number }>(
    `SELECT count(*)::int AS campers FROM assignments
      WHERE room_id = $1 AND active AND role = 'camper' AND person_id <> $2`,
    [request.roomId, request.personId],
  );
  // Other sessions that book the same physical room and whose days may overlap. The rule decides the overlap exactly.
  const { rows: uses } = await db.query<{ session_id: string; label: string; starts_on: string; ends_on: string }>(
    `SELECT a.session_id, c.name AS label, to_char(c.starts_on, 'YYYY-MM-DD') AS starts_on, to_char(c.ends_on, 'YYYY-MM-DD') AS ends_on
       FROM assignments a
       JOIN rooms r ON r.id = a.room_id AND r.org_id = a.org_id
       JOIN classes c ON c.id = a.session_id AND c.org_id = a.org_id
      WHERE a.active AND a.session_id <> $1
        AND lower(r.name) = lower($2) AND lower(r.location) = lower($3)
        AND c.starts_on <= $5::date AND c.ends_on >= $4::date`,
    [request.sessionId, locked.room.name, locked.room.location, locked.group.startsOn, locked.group.endsOn],
  );

  return {
    session: { startsOn: locked.group.startsOn, endsOn: locked.group.endsOn },
    person: { role: request.role, dateOfBirth: locked.person.dateOfBirth, holdsRole: locked.person.holdsRole },
    group: {
      capacity: locked.group.capacity,
      campers: counts[0].campers,
      staff: counts[0].staff,
      ratioCampers: locked.group.ratioCampers,
      ageRange: ageRangeOf(locked.group.ageMin, locked.group.ageMax),
    },
    room: { capacity: locked.room.capacity, campers: roomRows[0].campers },
    roomUses: uses.map(u => ({
      sessionId: u.session_id,
      label: u.label || 'another session',
      startsOn: u.starts_on,
      endsOn: u.ends_on,
    })),
  };
}

async function insertPlacement(
  db: Db,
  actor: Actor,
  request: AssignRequest,
  overrideReason: string | null,
): Promise<string> {
  let id: string;
  try {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO assignments (org_id, session_id, person_id, role, group_id, room_id, ratio_override_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [actor.orgId, request.sessionId, request.personId, request.role, request.groupId, request.roomId, overrideReason],
    );
    id = rows[0].id;
  } catch (error) {
    throw isUniqueViolation(error) ? new AssignmentConflictError() : error;
  }
  await recordAudit(db, {
    actor,
    action: 'assignment.create',
    entity: 'assignment',
    entityId: id,
    data: {
      sessionId: request.sessionId,
      personId: request.personId,
      role: request.role,
      groupId: request.groupId,
      roomId: request.roomId,
    },
  });

  return id;
}

/** A person already placed in this session is moved. Nothing is written when the place and the override are unchanged. */
async function moveOrKeep(
  db: Db,
  actor: Actor,
  request: AssignRequest,
  current: CurrentPlacement,
  overrideReason: string | null,
): Promise<string> {
  const moved =
    current.groupId !== request.groupId || current.roomId !== request.roomId || current.role !== request.role;
  if (!moved && current.overrideReason === overrideReason) {
    return current.id;
  }
  await db.query(
    `UPDATE assignments SET group_id = $2, room_id = $3, role = $4, ratio_override_reason = $5, updated_at = now() WHERE id = $1`,
    [current.id, request.groupId, request.roomId, request.role, overrideReason],
  );
  if (moved) {
    await recordAudit(db, {
      actor,
      action: 'assignment.move',
      entity: 'assignment',
      entityId: current.id,
      data: {
        sessionId: request.sessionId,
        personId: request.personId,
        fromGroupId: current.groupId,
        toGroupId: request.groupId,
        fromRoomId: current.roomId,
        toRoomId: request.roomId,
        role: request.role,
      },
    });
  }

  return current.id;
}

import { isUniqueViolation } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import type { Group, GroupInput, RoomInput } from '@buxa/contracts';
import { recordAudit } from '../audit/recordAudit';
import type { AuditData } from '../audit/types';
import type { Db } from '../people/pgRows';
import { CapacityBelowPlacedError, GroupNotFoundError, NameTakenError, RoomNotFoundError } from './errors';
import { requireGroup, requireRoom, requireSessionRow } from './PgGroupQueries';

/*
 * The group and room writes. Each runs inside the caller's transaction and writes its audit entry there too. A unique name clash
 * is translated to NameTakenError; a capacity below the places already taken is refused before the write.
 */

const groupAudit = (input: GroupInput): AuditData => ({
  name: input.name,
  capacity: input.capacity,
  ratioCampers: input.ratioCampers,
  ageMin: input.ageRange?.minAge ?? null,
  ageMax: input.ageRange?.maxAge ?? null,
});

export async function insertGroup(db: Db, actor: Actor, sessionId: string, input: GroupInput): Promise<string> {
  await requireSessionRow(db, sessionId);
  let id: string;
  try {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO groups (org_id, session_id, name, capacity, ratio_campers, age_min, age_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        actor.orgId,
        sessionId,
        input.name,
        input.capacity,
        input.ratioCampers,
        input.ageRange?.minAge ?? null,
        input.ageRange?.maxAge ?? null,
      ],
    );
    id = rows[0].id;
  } catch (error) {
    throw isUniqueViolation(error) ? new NameTakenError('group') : error;
  }
  await recordAudit(db, {
    actor,
    action: 'group.create',
    entity: 'group',
    entityId: id,
    data: { sessionId, ...groupAudit(input) },
  });

  return id;
}

/** Locks the group, refuses a capacity below the campers in it, and writes only when a value changed. */
export async function updateGroupRow(db: Db, actor: Actor, groupId: string, input: GroupInput): Promise<void> {
  const { rows } = await db.query<{ session_id: string }>(`SELECT session_id FROM groups WHERE id = $1 FOR UPDATE`, [
    groupId,
  ]);
  if (rows.length === 0) {
    throw new GroupNotFoundError();
  }
  const before = await requireGroup(db, groupId);
  if (input.capacity < before.campers) {
    throw new CapacityBelowPlacedError('group');
  }
  const after = {
    name: input.name,
    capacity: input.capacity,
    ratioCampers: input.ratioCampers,
    ageRange: input.ageRange,
  };
  if (sameGroup(before, after)) {
    return;
  }
  try {
    await db.query(
      `UPDATE groups SET name = $2, capacity = $3, ratio_campers = $4, age_min = $5, age_max = $6 WHERE id = $1`,
      [
        groupId,
        input.name,
        input.capacity,
        input.ratioCampers,
        input.ageRange?.minAge ?? null,
        input.ageRange?.maxAge ?? null,
      ],
    );
  } catch (error) {
    throw isUniqueViolation(error) ? new NameTakenError('group') : error;
  }
  await recordAudit(db, {
    actor,
    action: 'group.update',
    entity: 'group',
    entityId: groupId,
    data: { sessionId: rows[0].session_id, ...groupAudit(input) },
  });
}

function sameGroup(before: Group, after: Pick<Group, 'name' | 'capacity' | 'ratioCampers' | 'ageRange'>): boolean {
  return (
    before.name === after.name &&
    before.capacity === after.capacity &&
    before.ratioCampers === after.ratioCampers &&
    before.ageRange?.minAge === after.ageRange?.minAge &&
    before.ageRange?.maxAge === after.ageRange?.maxAge
  );
}

const roomAudit = (input: RoomInput): AuditData => ({
  name: input.name,
  location: input.location,
  capacity: input.capacity,
});

export async function insertRoom(db: Db, actor: Actor, sessionId: string, input: RoomInput): Promise<string> {
  await requireSessionRow(db, sessionId);
  let id: string;
  try {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO rooms (org_id, session_id, name, location, capacity) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [actor.orgId, sessionId, input.name, input.location, input.capacity],
    );
    id = rows[0].id;
  } catch (error) {
    throw isUniqueViolation(error) ? new NameTakenError('room') : error;
  }
  await recordAudit(db, {
    actor,
    action: 'room.create',
    entity: 'room',
    entityId: id,
    data: { sessionId, ...roomAudit(input) },
  });

  return id;
}

/** Locks the room, refuses a capacity below the campers in it, and writes only when a value changed. */
export async function updateRoomRow(db: Db, actor: Actor, roomId: string, input: RoomInput): Promise<void> {
  const { rows } = await db.query<{ session_id: string }>(`SELECT session_id FROM rooms WHERE id = $1 FOR UPDATE`, [
    roomId,
  ]);
  if (rows.length === 0) {
    throw new RoomNotFoundError();
  }
  const before = await requireRoom(db, roomId);
  if (input.capacity < before.campers) {
    throw new CapacityBelowPlacedError('room');
  }
  if (before.name === input.name && before.location === input.location && before.capacity === input.capacity) {
    return;
  }
  try {
    await db.query(`UPDATE rooms SET name = $2, location = $3, capacity = $4 WHERE id = $1`, [
      roomId,
      input.name,
      input.location,
      input.capacity,
    ]);
  } catch (error) {
    throw isUniqueViolation(error) ? new NameTakenError('room') : error;
  }
  await recordAudit(db, {
    actor,
    action: 'room.update',
    entity: 'room',
    entityId: roomId,
    data: { sessionId: rows[0].session_id, ...roomAudit(input) },
  });
}

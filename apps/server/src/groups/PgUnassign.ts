import type { Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import type { Db } from '../people/pgRows';
import type { UnassignRequest, Unassigned } from './GroupRepository';
import { AssignmentConflictError, GroupNotFoundError, NotAssignedError, PersonNotFoundError } from './errors';
import { currentPlacement, lockRoom } from './PgAssign';
import { requireSessionRow } from './PgGroupQueries';

/*
 * Ends a person's active placement in a session. Runs inside the caller's transaction (withOrg), and takes the same locks in the
 * same order as the placement write in PgAssign.ts: the person, then the group, then the room (with the camp-wide room lock). The
 * group and room are not known until the placement is read, so the placement is read first, under the person's lock, and read
 * again under the group and room locks to confirm it did not change. The row is set inactive, never deleted: the partial unique
 * index allows a later placement of the same person in the session.
 */
export async function unassignInTransaction(db: Db, actor: Actor, request: UnassignRequest): Promise<Unassigned> {
  await requireSessionRow(db, request.sessionId);
  await lockPersonRow(db, request.personId);
  const before = await currentPlacement(db, request.sessionId, request.personId);
  if (!before) {
    throw new NotAssignedError();
  }
  await lockGroupRow(db, before.groupId, request.sessionId);
  const room = await lockRoom(db, actor.orgId, before.roomId, request.sessionId);
  const after = await currentPlacement(db, request.sessionId, request.personId);
  if (!after || after.id !== before.id || after.groupId !== before.groupId || after.roomId !== before.roomId) {
    throw new AssignmentConflictError();
  }

  await db.query(`UPDATE assignments SET active = false, updated_at = now() WHERE id = $1`, [before.id]);
  await recordAudit(db, {
    actor,
    action: 'assignment.unassign',
    entity: 'assignment',
    entityId: before.id,
    data: {
      sessionId: request.sessionId,
      personId: request.personId,
      groupId: before.groupId,
      roomId: before.roomId,
      role: before.role,
      roomName: room.name,
    },
  });

  return { id: before.id, personId: request.personId, groupId: before.groupId, roomId: before.roomId };
}

async function lockPersonRow(db: Db, personId: string): Promise<void> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM people WHERE id = $1 FOR UPDATE`, [personId]);
  if (rows.length === 0) {
    throw new PersonNotFoundError();
  }
}

async function lockGroupRow(db: Db, groupId: string, sessionId: string): Promise<void> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM groups WHERE id = $1 AND session_id = $2 FOR UPDATE`,
    [groupId, sessionId],
  );
  if (rows.length === 0) {
    throw new GroupNotFoundError();
  }
}

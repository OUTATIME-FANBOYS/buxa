import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import type { GroupInput, RoomInput } from '@buxa/contracts';
import type { AssignRequest, AssignmentRule, GroupRepository } from './GroupRepository';
import type { Assignment, Group, Room } from './GroupRepository';
import { assignInTransaction } from './PgAssign';
import {
  listAssignmentRows,
  listGroupRows,
  listRoomRows,
  requireAssignment,
  requireGroup,
  requireRoom,
} from './PgGroupQueries';
import { insertGroup, insertRoom, updateGroupRow, updateRoomRow } from './PgGroupWrites';

/**
 * Postgres adapter for groups, rooms and assignments. Every call runs in withOrg (row-level security), and every write writes its
 * audit entry in the same transaction. Refusals are thrown from inside the transaction, so nothing is written for them. The
 * capacity, age, ratio and overlap rules run inside `assign` under the locks described in PgAssign.ts.
 */
export class PgGroupRepository implements GroupRepository {
  constructor(private readonly pool: Pool) {}

  listGroups(userId: string, orgId: string, sessionId: string): Promise<Group[]> {
    return withOrg(this.pool, userId, orgId, db => listGroupRows(db, sessionId));
  }

  listRooms(userId: string, orgId: string, sessionId: string): Promise<Room[]> {
    return withOrg(this.pool, userId, orgId, db => listRoomRows(db, sessionId));
  }

  listAssignments(userId: string, orgId: string, sessionId: string): Promise<Assignment[]> {
    return withOrg(this.pool, userId, orgId, db => listAssignmentRows(db, sessionId));
  }

  createGroup(actor: Actor, sessionId: string, input: GroupInput): Promise<Group> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const id = await insertGroup(db, actor, sessionId, input);

      return requireGroup(db, id);
    });
  }

  updateGroup(actor: Actor, groupId: string, input: GroupInput): Promise<Group> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await updateGroupRow(db, actor, groupId, input);

      return requireGroup(db, groupId);
    });
  }

  createRoom(actor: Actor, sessionId: string, input: RoomInput): Promise<Room> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const id = await insertRoom(db, actor, sessionId, input);

      return requireRoom(db, id);
    });
  }

  updateRoom(actor: Actor, roomId: string, input: RoomInput): Promise<Room> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await updateRoomRow(db, actor, roomId, input);

      return requireRoom(db, roomId);
    });
  }

  assign(actor: Actor, request: AssignRequest, rule: AssignmentRule): Promise<Assignment> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const id = await assignInTransaction(db, actor, request, rule);

      return requireAssignment(db, id);
    });
  }
}

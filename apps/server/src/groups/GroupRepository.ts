import type { Actor, AssignmentDecision, AssignmentFacts, AssignRole } from '@buxa/domain';
import type { Assignment, Group, GroupInput, Room, RoomInput } from '@buxa/contracts';

export type { Assignment, Group, Room } from '@buxa/contracts';

/** What placing one person needs to name: the session, the person, the role, and the group and room to place them in. */
export interface AssignRequest {
  sessionId: string;
  personId: string;
  role: AssignRole;
  groupId: string;
  roomId: string;
}

/** The facts the assignment rule needs, gathered inside the transaction. */
export type GatheredAssignmentFacts = AssignmentFacts;

/**
 * The decision callback. The repository calls it inside the transaction, after locking the person, the group and the room, so the
 * facts it sees are the ones the write is based on. It must be pure: the service passes the domain rule, nothing else.
 */
export type AssignmentRule = (facts: GatheredAssignmentFacts) => AssignmentDecision;

/**
 * Storage for groups, rooms and assignments in one session. Callers decide whether something may happen (permissions); the
 * domain rules in @buxa/domain decide whether a placement is allowed. Implementations persist the change and write its audit entry
 * in the same transaction. Every method is scoped to the actor's organisation. Refusals and missing rows are thrown as the
 * errors in ./errors.ts after the transaction is rolled back, so nothing is written for a refused change.
 */
export interface GroupRepository {
  /** Throws SessionNotFoundError. */
  listGroups(userId: string, orgId: string, sessionId: string): Promise<Group[]>;
  /** Throws SessionNotFoundError. */
  listRooms(userId: string, orgId: string, sessionId: string): Promise<Room[]>;
  /** The active assignments of a session, with each person's name. Throws SessionNotFoundError. */
  listAssignments(userId: string, orgId: string, sessionId: string): Promise<Assignment[]>;
  /** Audits `group.create`. Throws SessionNotFoundError, NameTakenError. */
  createGroup(actor: Actor, sessionId: string, input: GroupInput): Promise<Group>;
  /** Audits `group.update` when a value changed. Throws GroupNotFoundError, NameTakenError, CapacityBelowPlacedError. */
  updateGroup(actor: Actor, groupId: string, input: GroupInput): Promise<Group>;
  /** Audits `room.create`. Throws SessionNotFoundError, NameTakenError. */
  createRoom(actor: Actor, sessionId: string, input: RoomInput): Promise<Room>;
  /** Audits `room.update` when a value changed. Throws RoomNotFoundError, NameTakenError, CapacityBelowPlacedError. */
  updateRoom(actor: Actor, roomId: string, input: RoomInput): Promise<Room>;
  /**
   * The only place that checks and places a person. In one transaction, under locks taken in a fixed order (person, group, room):
   * gathers the facts, runs `rule`, and on `allow` writes the placement (a new assignment, or a move of an existing one in this
   * session) and its audit entries (`assignment.create` or `assignment.move`, plus `assignment.override` when a ratio was overridden).
   * On `refuse` it throws AssignmentRefusedError and writes nothing. Throws PersonNotFoundError, GroupNotFoundError,
   * RoomNotFoundError, AssignmentConflictError.
   */
  assign(actor: Actor, request: AssignRequest, rule: AssignmentRule): Promise<Assignment>;
}

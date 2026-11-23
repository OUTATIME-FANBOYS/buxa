import {
  can,
  decideAssignment,
  describeAssignmentRefusal,
  type Actor,
  type AssignmentOptions,
  type AssignmentRefusal,
} from '@buxa/domain';
import type { AssignInput, Assignment, Group, GroupInput, Room, RoomInput } from '@buxa/contracts';
import { assertAllowed } from '../auth/authorize';
import type { AssignRequest, GroupRepository } from './GroupRepository';
import {
  isAssignmentConflict,
  isAssignmentRefused,
  isCapacityBelowPlaced,
  isGroupNotFound,
  isNameTaken,
  isPersonNotFound,
  isRoomNotFound,
  isSessionNotFound,
  isSessionUndated,
} from './errors';

/** A failure a screen can show: a stable reason, the copy to show, and (for a refusal) the refusal itself. */
export interface GroupFailure {
  reason: string;
  message: string;
  refusal?: AssignmentRefusal;
}

export type GroupOutcome<T> = { ok: true; value: T } | { ok: false; failure: GroupFailure };

export interface GroupServiceDeps {
  repo: GroupRepository;
}

/**
 * What a screen or an API route may ask of groups, rooms and assignments. Each method checks its permission first (a denial throws
 * a 403, so a viewer cannot place anyone) and returns an outcome for the expected cases. Reads need people:read; every change needs
 * classes:manage; a ratio override needs attendance:override (admins and owners).
 */
export interface GroupService {
  listGroups(actor: Actor, sessionId: string): Promise<GroupOutcome<Group[]>>;
  listRooms(actor: Actor, sessionId: string): Promise<GroupOutcome<Room[]>>;
  listAssignments(actor: Actor, sessionId: string): Promise<GroupOutcome<Assignment[]>>;
  createGroup(actor: Actor, sessionId: string, input: GroupInput): Promise<GroupOutcome<Group>>;
  updateGroup(actor: Actor, groupId: string, input: GroupInput): Promise<GroupOutcome<Group>>;
  createRoom(actor: Actor, sessionId: string, input: RoomInput): Promise<GroupOutcome<Room>>;
  updateRoom(actor: Actor, roomId: string, input: RoomInput): Promise<GroupOutcome<Room>>;
  /** Places a person, or moves them within the session. Every rule runs; a refusal comes back with its reason. */
  assign(actor: Actor, input: AssignInput): Promise<GroupOutcome<Assignment>>;
}

export function createGroupService({ repo }: GroupServiceDeps): GroupService {
  return {
    async listGroups(actor, sessionId) {
      assertAllowed(actor, 'people:read');

      return attempt(() => repo.listGroups(actor.userId, actor.orgId, sessionId));
    },

    async listRooms(actor, sessionId) {
      assertAllowed(actor, 'people:read');

      return attempt(() => repo.listRooms(actor.userId, actor.orgId, sessionId));
    },

    async listAssignments(actor, sessionId) {
      assertAllowed(actor, 'people:read');

      return attempt(() => repo.listAssignments(actor.userId, actor.orgId, sessionId));
    },

    async createGroup(actor, sessionId, input) {
      assertAllowed(actor, 'classes:manage');

      return attempt(() => repo.createGroup(actor, sessionId, input));
    },

    async updateGroup(actor, groupId, input) {
      assertAllowed(actor, 'classes:manage');

      return attempt(() => repo.updateGroup(actor, groupId, input));
    },

    async createRoom(actor, sessionId, input) {
      assertAllowed(actor, 'classes:manage');

      return attempt(() => repo.createRoom(actor, sessionId, input));
    },

    async updateRoom(actor, roomId, input) {
      assertAllowed(actor, 'classes:manage');

      return attempt(() => repo.updateRoom(actor, roomId, input));
    },

    async assign(actor, input) {
      assertAllowed(actor, 'classes:manage');
      const request: AssignRequest = {
        sessionId: input.sessionId,
        personId: input.personId,
        role: input.role,
        groupId: input.groupId,
        roomId: input.roomId,
      };

      return attempt(() => repo.assign(actor, request, facts => decideAssignment(facts, optionsFor(actor, input))));
    },
  };
}

/** The override the person asked for, and whether they may use one (admins and owners). */
function optionsFor(actor: Actor, input: AssignInput): AssignmentOptions {
  return { override: input.override ?? null, actorCanOverride: can(actor, 'attendance:override') };
}

/** Runs one repository call and turns the expected errors into outcomes. Anything else is unexpected and is rethrown. */
async function attempt<T>(work: () => Promise<T>): Promise<GroupOutcome<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    if (isAssignmentRefused(error)) {
      return {
        ok: false,
        failure: {
          reason: error.refusal.reason,
          message: describeAssignmentRefusal(error.refusal),
          refusal: error.refusal,
        },
      };
    }
    const failure = failureOf(error);
    if (failure) {
      return { ok: false, failure };
    }
    throw error;
  }
}

/** The copy for each expected error that is not a refusal. Null for anything unexpected. */
function failureOf(error: unknown): GroupFailure | null {
  if (isSessionNotFound(error)) {
    return { reason: 'session_not_found', message: 'That session no longer exists.' };
  }
  if (isSessionUndated(error)) {
    return {
      reason: 'session_undated',
      message: 'Give this session its first and last day before placing people in it.',
    };
  }
  if (isGroupNotFound(error)) {
    return { reason: 'group_not_found', message: 'That group no longer exists.' };
  }
  if (isRoomNotFound(error)) {
    return { reason: 'room_not_found', message: 'That room no longer exists.' };
  }
  if (isPersonNotFound(error)) {
    return { reason: 'person_not_found', message: 'That person does not exist in this camp.' };
  }
  if (isNameTaken(error)) {
    return { reason: 'name_taken', message: `That ${error.what} name is already used in this session.` };
  }
  if (isCapacityBelowPlaced(error)) {
    return {
      reason: 'capacity_below_placed',
      message: `The ${error.what} capacity is below the campers already placed in it.`,
    };
  }
  if (isAssignmentConflict(error)) {
    return {
      reason: 'assignment_conflict',
      message: 'This person was just placed by another change. Refresh and try again.',
    };
  }

  return null;
}

import type { AssignmentRefusal } from '@buxa/domain';

/*
 * Domain errors for groups, rooms and assignments. Adapters throw these; the service maps them to outcomes.
 * Recognised by `kind`, never `instanceof`, because Next.js can load a module more than once (see server/http/errors.ts).
 */

export class SessionNotFoundError extends Error {
  readonly kind = 'session-not-found';
  constructor() {
    super('Session not found');
    this.name = 'SessionNotFoundError';
  }
}

/** The session has no first and last day yet, so its camp days (and so the ages and room days) cannot be read. */
export class SessionUndatedError extends Error {
  readonly kind = 'session-undated';
  constructor() {
    super('Session has no dates');
    this.name = 'SessionUndatedError';
  }
}

export class GroupNotFoundError extends Error {
  readonly kind = 'group-not-found';
  constructor() {
    super('Group not found');
    this.name = 'GroupNotFoundError';
  }
}

export class RoomNotFoundError extends Error {
  readonly kind = 'room-not-found';
  constructor() {
    super('Room not found');
    this.name = 'RoomNotFoundError';
  }
}

export class PersonNotFoundError extends Error {
  readonly kind = 'person-not-found';
  constructor() {
    super('Person not found');
    this.name = 'PersonNotFoundError';
  }
}

/** A group or room name is already used in this session (names are unique per session, ignoring case). */
export class NameTakenError extends Error {
  readonly kind = 'name-taken';
  constructor(readonly what: 'group' | 'room') {
    super(`That ${what} name is already used in this session`);
    this.name = 'NameTakenError';
  }
}

/** A group or room cannot be given less room than the campers already in it. */
export class CapacityBelowPlacedError extends Error {
  readonly kind = 'capacity-below-placed';
  constructor(readonly what: 'group' | 'room') {
    super(`The ${what} capacity is below the campers already placed in it`);
    this.name = 'CapacityBelowPlacedError';
  }
}

/** The person was placed by a parallel write between the check and the insert. Nothing from this call is kept. */
export class AssignmentConflictError extends Error {
  readonly kind = 'assignment-conflict';
  constructor() {
    super('The person was placed by another change at the same time');
    this.name = 'AssignmentConflictError';
  }
}

/** The person has no active assignment in this session, so there is nothing to unassign. Nothing is written. */
export class NotAssignedError extends Error {
  readonly kind = 'not-assigned';
  constructor() {
    super('The person has no active assignment in this session');
    this.name = 'NotAssignedError';
  }
}

/** An assignment the rules refused. Thrown after the transaction is rolled back, so nothing is written for it. */
export class AssignmentRefusedError extends Error {
  readonly kind = 'assignment-refused';
  constructor(readonly refusal: AssignmentRefusal) {
    super(`Assignment refused: ${refusal.reason}`);
    this.name = 'AssignmentRefusedError';
  }
}

/** True when the error carries this marker. Markers, not instanceof, so a module loaded twice still recognises its errors. */
export function isGroupError(error: unknown, kind: string): boolean {
  return typeof error === 'object' && error !== null && 'kind' in error && error.kind === kind;
}

export const isSessionNotFound = (e: unknown): e is SessionNotFoundError => isGroupError(e, 'session-not-found');
export const isSessionUndated = (e: unknown): e is SessionUndatedError => isGroupError(e, 'session-undated');
export const isGroupNotFound = (e: unknown): e is GroupNotFoundError => isGroupError(e, 'group-not-found');
export const isRoomNotFound = (e: unknown): e is RoomNotFoundError => isGroupError(e, 'room-not-found');
export const isPersonNotFound = (e: unknown): e is PersonNotFoundError => isGroupError(e, 'person-not-found');
export const isNameTaken = (e: unknown): e is NameTakenError => isGroupError(e, 'name-taken');
export const isCapacityBelowPlaced = (e: unknown): e is CapacityBelowPlacedError =>
  isGroupError(e, 'capacity-below-placed');
export const isAssignmentConflict = (e: unknown): e is AssignmentConflictError =>
  isGroupError(e, 'assignment-conflict');
export const isAssignmentRefused = (e: unknown): e is AssignmentRefusedError => isGroupError(e, 'assignment-refused');
export const isNotAssigned = (e: unknown): e is NotAssignedError => isGroupError(e, 'not-assigned');

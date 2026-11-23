import { checkAge, type AgeRange } from '../classes/ageRange';
import { findClash } from '../classes/interval';
import type { LocalDate } from '../people/localDate';
import { daySpan } from './days';

/** The roles an assignment can place: a camper in a group, or a staff member who counts toward the group's ratio. */
export type AssignRole = 'camper' | 'staff';

/** One use of a room by another session: its name for the refusal, and its camp days (both inclusive). */
export interface RoomUse {
  sessionId: string;
  label: string;
  startsOn: LocalDate;
  endsOn: LocalDate;
}

/**
 * The facts the assignment rules need, gathered inside the repository's transaction. Counts exclude the person being placed,
 * so a move is judged as if the person were not in the group yet.
 */
export interface AssignmentFacts {
  /** The session's camp days, both inclusive. The age is taken on `startsOn`. */
  session: { startsOn: LocalDate; endsOn: LocalDate };
  person: {
    role: AssignRole;
    dateOfBirth: LocalDate | null;
    /** True when the person holds the role being placed (a camper placed as a camper, a staff member as staff). */
    holdsRole: boolean;
  };
  group: {
    capacity: number;
    /** Active campers in the group. Staff do not count toward capacity. */
    campers: number;
    /** Active staff in the group. The ratio is checked against this. */
    staff: number;
    /** Campers per staff member, or null when the group has no ratio. */
    ratioCampers: number | null;
    /** The group's age range, or null when it has none. */
    ageRange: AgeRange | null;
  };
  room: {
    capacity: number;
    /** Active campers already in this room for this session. */
    campers: number;
  };
  /** Other sessions' active uses of a room with the same name and location. Only those whose days may overlap are passed in. */
  roomUses: readonly RoomUse[];
}

export interface AssignmentOptions {
  /** A ratio override, with its reason. Null when none was asked for. */
  override: { reason: string } | null;
  /** True when the actor may override (admins and owners). */
  actorCanOverride: boolean;
}

export type AssignmentRefusal = Extract<AssignmentDecision, { kind: 'refuse' }>;

export type AssignmentDecision =
  | { kind: 'allow'; overrode: { reason: string; campers: number; staff: number; ratioCampers: number } | null }
  | { kind: 'refuse'; reason: 'override_needs_reason' }
  | { kind: 'refuse'; reason: 'override_not_allowed' }
  | { kind: 'refuse'; reason: 'role_missing'; role: AssignRole }
  | { kind: 'refuse'; reason: 'group_full'; capacity: number }
  | { kind: 'refuse'; reason: 'age_unknown' }
  | { kind: 'refuse'; reason: 'age_out_of_range'; age: number; range: AgeRange }
  | { kind: 'refuse'; reason: 'room_overlap'; clash: RoomUse }
  | { kind: 'refuse'; reason: 'room_full'; capacity: number }
  | { kind: 'refuse'; reason: 'ratio'; campers: number; staff: number; ratioCampers: number };

/** A group's ratio holds when its campers do not exceed the ratio times its staff. No ratio means no limit. */
export function ratioHolds(campers: number, staff: number, ratioCampers: number | null): boolean {
  return ratioCampers === null || campers <= ratioCampers * staff;
}

/**
 * The assignment rules (phase 4, decisions 2 to 4). Checked in this order: override validity, the role, capacity, age, room
 * overlap, room capacity, ratio. Capacity, age and room rules are hard limits. Only a ratio refusal can be overridden, and only
 * by an actor who may override. Pure: the repository gathers the facts inside its transaction and calls this.
 */
export function decideAssignment(f: AssignmentFacts, o: AssignmentOptions): AssignmentDecision {
  if (o.override !== null) {
    if (!o.actorCanOverride) {
      return { kind: 'refuse', reason: 'override_not_allowed' };
    }
    if (o.override.reason.trim() === '') {
      return { kind: 'refuse', reason: 'override_needs_reason' };
    }
  }

  if (!f.person.holdsRole) {
    return { kind: 'refuse', reason: 'role_missing', role: f.person.role };
  }

  if (f.person.role === 'staff') {
    return roomOverlap(f) ?? { kind: 'allow', overrode: null };
  }

  if (f.group.campers + 1 > f.group.capacity) {
    return { kind: 'refuse', reason: 'group_full', capacity: f.group.capacity };
  }

  if (f.group.ageRange !== null) {
    if (f.person.dateOfBirth === null) {
      return { kind: 'refuse', reason: 'age_unknown' };
    }
    const age = checkAge(f.person.dateOfBirth, f.session.startsOn, f.group.ageRange);
    if (!age.ok) {
      return { kind: 'refuse', reason: 'age_out_of_range', age: age.age, range: age.range };
    }
  }

  const overlap = roomOverlap(f);
  if (overlap !== null) {
    return overlap;
  }

  if (f.room.campers + 1 > f.room.capacity) {
    return { kind: 'refuse', reason: 'room_full', capacity: f.room.capacity };
  }

  const campers = f.group.campers + 1;
  if (ratioHolds(campers, f.group.staff, f.group.ratioCampers)) {
    return { kind: 'allow', overrode: null };
  }
  const ratioCampers = f.group.ratioCampers ?? 0;
  if (o.override === null || !o.actorCanOverride) {
    return { kind: 'refuse', reason: 'ratio', campers, staff: f.group.staff, ratioCampers };
  }

  return {
    kind: 'allow',
    overrode: { reason: o.override.reason.trim(), campers, staff: f.group.staff, ratioCampers },
  };
}

/** A room serves one session at a time: a use whose camp days share any day with this session refuses. Touching sessions do not. */
function roomOverlap(f: AssignmentFacts): AssignmentRefusal | null {
  const spans = f.roomUses.map(use => ({ ...daySpan(use.startsOn, use.endsOn), use }));
  const clash = findClash(daySpan(f.session.startsOn, f.session.endsOn), spans);

  return clash === null ? null : { kind: 'refuse', reason: 'room_overlap', clash: clash.use };
}

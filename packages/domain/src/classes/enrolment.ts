import type { LocalDate } from '../people/localDate';
import { checkAge, type AgeRange } from './ageRange';
import { seatFor } from './capacity';
import { findClash, type Span } from './interval';

/** A session as the enrolment rules see it. */
export interface SessionFacts extends Span {
  sessionId: string;
  className: string;
  capacity: number;
  ageRange: AgeRange;
}

/** One of the camper's existing enrolments in the camp (enrolled or waitlisted). Cancelled ones are not passed in. */
export interface ActiveEnrolmentFacts extends Span {
  sessionId: string;
  className: string;
}

export interface EnrolmentFacts {
  session: SessionFacts;
  /** Enrolled campers only. */
  seatsTaken: number;
  camperDateOfBirth: LocalDate | null;
  /** The camp-local day the session starts; the age is taken on this day. */
  sessionDay: LocalDate;
  camperActive: readonly ActiveEnrolmentFacts[];
}

export interface EnrolmentOptions {
  /** When full, place the camper on the waitlist instead of refusing. */
  waitlistIfFull: boolean;
  /** An override of an overlap, with its reason. Null when none was asked for. */
  override: { reason: string } | null;
  /** True when the actor holds the override permission (admins). */
  actorCanOverride: boolean;
}

export type EnrolmentDecision =
  | { kind: 'allow'; status: 'enrolled' | 'waitlisted'; overrode: { reason: string; clash: ActiveEnrolmentFacts } | null }
  | { kind: 'refuse'; reason: 'age_unknown' }
  | { kind: 'refuse'; reason: 'age_out_of_range'; age: number; range: AgeRange }
  | { kind: 'refuse'; reason: 'overlap'; clash: ActiveEnrolmentFacts }
  | { kind: 'refuse'; reason: 'session_full'; capacity: number }
  | { kind: 'refuse'; reason: 'override_needs_reason' }
  | { kind: 'refuse'; reason: 'override_not_allowed' };

/**
 * The enrolment rules (spec decisions 2-4). Checked in this order: override validity, age, overlap, capacity.
 * Age and capacity are hard limits; only an overlap can be overridden, and only by an actor who may override.
 * Pure: the repository gathers the facts inside its transaction and calls this, so the rule and the write agree.
 */
export function decideEnrolment(f: EnrolmentFacts, o: EnrolmentOptions): EnrolmentDecision {
  if (o.override !== null) {
    if (!o.actorCanOverride) return { kind: 'refuse', reason: 'override_not_allowed' };
    if (o.override.reason.trim() === '') return { kind: 'refuse', reason: 'override_needs_reason' };
  }

  if (f.camperDateOfBirth === null) return { kind: 'refuse', reason: 'age_unknown' };
  const age = checkAge(f.camperDateOfBirth, f.sessionDay, f.session.ageRange);
  if (!age.ok) return { kind: 'refuse', reason: 'age_out_of_range', age: age.age, range: age.range };

  const clash = findClash(f.session, f.camperActive);
  let overrode: { reason: string; clash: ActiveEnrolmentFacts } | null = null;
  if (clash !== null) {
    if (o.override === null || !o.actorCanOverride) return { kind: 'refuse', reason: 'overlap', clash };
    overrode = { reason: o.override.reason.trim(), clash };
  }

  const seat = seatFor(f.session.capacity, f.seatsTaken);
  if (seat.kind === 'seat') return { kind: 'allow', status: 'enrolled', overrode };
  if (o.waitlistIfFull) return { kind: 'allow', status: 'waitlisted', overrode };
  return { kind: 'refuse', reason: 'session_full', capacity: seat.capacity };
}

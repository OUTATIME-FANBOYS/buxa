import type { Refusal } from '@buxa/domain';

/*
 * Domain errors for classes and enrolment. Adapters throw these; services map them to outcomes.
 * Recognised by `kind`, never `instanceof`, because Next.js can load a module more than once (see server/http/errors.ts).
 */

export class ClassNotFoundError extends Error {
  readonly kind = 'class-not-found';
  constructor() {
    super('Class not found');
    this.name = 'ClassNotFoundError';
  }
}

/** The parent session (a date range that holds classes) is not in this camp. */
export class SessionNotFoundError extends Error {
  readonly kind = 'session-not-found';
  constructor() {
    super('Session not found');
    this.name = 'SessionNotFoundError';
  }
}

/** A class's time range falls outside its session's dates. */
export class ClassOutsideSessionError extends Error {
  readonly kind = 'class-outside-session';
  constructor(
    readonly startsOn: string,
    readonly endsOn: string,
  ) {
    super('The class falls outside the session dates');
    this.name = 'ClassOutsideSessionError';
  }
}

/** A teacher changed a class field other than its name and description. Only classes:manage may change those. */
export class TeacherFieldRefusedError extends Error {
  readonly kind = 'teacher-field-refused';
  constructor(readonly fields: readonly string[]) {
    super(`A teacher can change only the name and description of a class. This would change: ${fields.join(', ')}.`);
    this.name = 'TeacherFieldRefusedError';
  }
}

/** A class cannot be given fewer places than the campers already enrolled in it. */
export class CapacityBelowEnrolledError extends Error {
  readonly kind = 'capacity-below-enrolled';
  constructor() {
    super('The camp size is below the places already taken');
    this.name = 'CapacityBelowEnrolledError';
  }
}

/** A class with any enrolment (cancelled ones included) cannot be deleted. */
export class ClassHasEnrolmentsError extends Error {
  readonly kind = 'class-has-enrolments';
  constructor() {
    super('The class has enrolments');
    this.name = 'ClassHasEnrolmentsError';
  }
}

export const SESSION_HAS_CLASSES_MESSAGE = 'This session has classes. Delete them first.';

/** A session (the parent) that still holds classes cannot be deleted. Migration 0035 refuses it at the database too. */
export class SessionHasClassesError extends Error {
  readonly kind = 'session-has-classes';
  constructor() {
    super(SESSION_HAS_CLASSES_MESSAGE);
    this.name = 'SessionHasClassesError';
  }
}

export class EnrolmentNotFoundError extends Error {
  readonly kind = 'enrolment-not-found';
  constructor() {
    super('Enrolment not found');
    this.name = 'EnrolmentNotFoundError';
  }
}

export class CamperNotFoundError extends Error {
  readonly kind = 'camper-not-found';
  constructor() {
    super('Camper not found');
    this.name = 'CamperNotFoundError';
  }
}

/** A session names an instructor who is not a person in this camp. */
export class InstructorNotFoundError extends Error {
  readonly kind = 'instructor-not-found';
  constructor() {
    super('Instructor not found');
    this.name = 'InstructorNotFoundError';
  }
}

/** The refusals an adapter throws from inside the enrolment transaction, so nothing is written. Each carries the domain refusal. */
/** A class's teacher must be a member of this camp with the teacher role. */
export class TeacherNotFoundError extends Error {
  readonly kind = 'teacher-not-found';
  constructor() {
    super('Teacher not found');
    this.name = 'TeacherNotFoundError';
  }
}

export class SessionFullError extends Error {
  readonly kind = 'session-full';
  constructor(readonly refusal: Extract<Refusal, { reason: 'session_full' }>) {
    super('Session is full');
    this.name = 'SessionFullError';
  }
}

export class AgeOutOfRangeError extends Error {
  readonly kind = 'age-out-of-range';
  constructor(readonly refusal: Extract<Refusal, { reason: 'age_out_of_range' }>) {
    super('Camper is outside the age range');
    this.name = 'AgeOutOfRangeError';
  }
}

export class OverlapError extends Error {
  readonly kind = 'overlap';
  constructor(readonly refusal: Extract<Refusal, { reason: 'overlap' }>) {
    super('Camper has an overlapping enrolment');
    this.name = 'OverlapError';
  }
}

/** Any other refusal (unknown age, override without a reason, override by a non-admin). */
export class EnrolmentRefusedError extends Error {
  readonly kind = 'enrolment-refused';
  constructor(readonly refusal: Refusal) {
    super(`Enrolment refused: ${refusal.reason}`);
    this.name = 'EnrolmentRefusedError';
  }
}

export type EnrolmentRefusalError = SessionFullError | AgeOutOfRangeError | OverlapError | EnrolmentRefusedError;

/** The error an adapter throws for a refused decision. */
export function refusalError(refusal: Refusal): EnrolmentRefusalError {
  switch (refusal.reason) {
    case 'session_full':
      return new SessionFullError(refusal);
    case 'age_out_of_range':
      return new AgeOutOfRangeError(refusal);
    case 'overlap':
      return new OverlapError(refusal);
    default:
      return new EnrolmentRefusedError(refusal);
  }
}

/** A seat hold names a household that is not in this camp (or a malformed id). */
export class HouseholdNotFoundError extends Error {
  readonly kind = 'household-not-found';
  constructor() {
    super('Household not found');
    this.name = 'HouseholdNotFoundError';
  }
}

export class HoldNotFoundError extends Error {
  readonly kind = 'hold-not-found';
  constructor() {
    super('Hold not found');
    this.name = 'HoldNotFoundError';
  }
}

/** The household already holds a place in this session. One hold per household per session. */
export class HoldExistsError extends Error {
  readonly kind = 'hold-exists';
  constructor() {
    super('The household already holds a place in this session');
    this.name = 'HoldExistsError';
  }
}

/**
 * A recurring rule that cannot be expanded, or a class of the series that clashes with a class already in the camp or with an
 * earlier class of the same series. Thrown before anything is written, so a refused series saves nothing.
 */
export class RecurrenceRefusedError extends Error {
  readonly kind = 'recurrence-refused';
  constructor(
    readonly reason: 'recurrence_invalid' | 'class_clash',
    message: string,
  ) {
    super(message);
    this.name = 'RecurrenceRefusedError';
  }
}

export type ClassErrorKind =
  | 'class-not-found'
  | 'session-not-found'
  | 'class-outside-session'
  | 'capacity-below-enrolled'
  | 'class-has-enrolments'
  | 'session-has-classes'
  | 'enrolment-not-found'
  | 'camper-not-found'
  | 'instructor-not-found'
  | 'household-not-found'
  | 'hold-not-found'
  | 'hold-exists'
  | 'teacher-not-found'
  | 'teacher-field-refused'
  | EnrolmentRefusalError['kind'];

export const isClassError = (e: unknown, kind: ClassErrorKind): boolean =>
  e instanceof Error && 'kind' in e && e.kind === kind;

export const isEnrolmentRefusal = (e: unknown): e is EnrolmentRefusalError =>
  e instanceof Error &&
  'kind' in e &&
  typeof e.kind === 'string' &&
  ['session-full', 'age-out-of-range', 'overlap', 'enrolment-refused'].includes(e.kind);

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

export class SessionNotFoundError extends Error {
  readonly kind = 'session-not-found';
  constructor() {
    super('Session not found');
    this.name = 'SessionNotFoundError';
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

export type ClassErrorKind =
  | 'class-not-found'
  | 'session-not-found'
  | 'enrolment-not-found'
  | 'camper-not-found'
  | 'instructor-not-found'
  | EnrolmentRefusalError['kind'];

export const isClassError = (e: unknown, kind: ClassErrorKind): boolean =>
  e instanceof Error && 'kind' in e && e.kind === kind;

export const isEnrolmentRefusal = (e: unknown): e is EnrolmentRefusalError =>
  e instanceof Error &&
  'kind' in e &&
  typeof e.kind === 'string' &&
  ['session-full', 'age-out-of-range', 'overlap', 'enrolment-refused'].includes(e.kind);

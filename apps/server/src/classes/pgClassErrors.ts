import {
  AlreadyEnrolledError,
  CapacityBelowEnrolledError,
  ClassHasEnrolmentsError,
  ClassNotFoundError,
  SessionFullError,
  SessionHasClassesError,
  SessionHasEnrolmentsError,
  SessionNameTakenError,
  RecurrenceRefusedError,
  SessionNotDraftError,
  SessionNotFoundError,
} from './errors';

/*
 * Driver errors never leave the adapter. The capacity trigger in migration 0008 raises a named check violation when a
 * session is full, and migration 0022 names the errors of a class write. These are the database errors that mean a business
 * refusal, so they are the ones translated here.
 */

const CHECK_VIOLATION = '23514';
const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';
const EXCLUSION_VIOLATION = '23P01';
/** The exclusion constraint of migration 0066: two active days overlap in one location. Reached only by a race the lock did not cover. */
export const LOCATION_CONSTRAINT = 'sessions_location_overlap';
const LOCATION_RACE_MESSAGE =
  'Two classes in the same location cannot overlap. Choose other times, days or a location; nothing was saved.';
export const SESSION_NAME_CONSTRAINT = 'classes_org_name_normal_key';
export const CAPACITY_CONSTRAINT = 'enrolments_capacity';

/** True for a Postgres error with this SQLSTATE and, when given, this constraint name. Anything else (including non-errors) is false. */
function isPgError(error: unknown, code: string, constraint: string | null): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  if (!('code' in error) || error.code !== code) {
    return false;
  }

  return constraint === null || ('constraint' in error && error.constraint === constraint);
}

/**
 * Turns the errors of a class write into domain errors: a camp size below the places taken (the capacity floor trigger), a delete
 * refused because of enrolments (buxa_delete_class), and a class that is not in the camp (P0002 from the functions).
 * Any other error is returned unchanged.
 */
export function translateClassWriteError(error: unknown): unknown {
  if (isPgError(error, CHECK_VIOLATION, 'sessions_capacity_floor')) {
    return new CapacityBelowEnrolledError();
  }
  if (isPgError(error, FOREIGN_KEY_VIOLATION, 'sessions_has_enrolments')) {
    return new ClassHasEnrolmentsError();
  }
  if (isPgError(error, 'P0002', null)) {
    return new ClassNotFoundError();
  }
  if (isPgError(error, EXCLUSION_VIOLATION, LOCATION_CONSTRAINT)) {
    return new RecurrenceRefusedError('class_clash', LOCATION_RACE_MESSAGE);
  }

  return error;
}

/** Turns the duplicate-place error of an enrolment (one active enrolment per child per series, migration 0061) into AlreadyEnrolledError. */
export function translateEnrolmentWriteError(error: unknown): unknown {
  if (isPgError(error, UNIQUE_VIOLATION, 'enrolments_one_active_series_idx')) {
    return new AlreadyEnrolledError();
  }

  return error;
}

/** Turns the errors of a session delete into domain errors: a session that holds classes (migration 0035), or one not in the camp. */
export function translateSessionDeleteError(error: unknown): unknown {
  if (isPgError(error, FOREIGN_KEY_VIOLATION, 'classes_has_classes')) {
    return new SessionHasClassesError();
  }
  if (isPgError(error, FOREIGN_KEY_VIOLATION, 'session_not_draft')) {
    return new SessionNotDraftError('live');
  }
  if (isPgError(error, FOREIGN_KEY_VIOLATION, 'session_has_enrolments')) {
    return new SessionHasEnrolmentsError();
  }
  if (isPgError(error, 'P0002', null)) {
    return new SessionNotFoundError();
  }

  return translateClassWriteError(error);
}

/** Turns the unique index on session names (migration 0052) into SessionNameTakenError for the name that was written. */
export function translateSessionNameError(error: unknown, sessionName: string): unknown {
  return isPgError(error, UNIQUE_VIOLATION, SESSION_NAME_CONSTRAINT) ? new SessionNameTakenError(sessionName) : error;
}

/** Turns the capacity trigger's error into a SessionFullError for `capacity`. Any other error is returned unchanged. */
export function translateCapacityError(error: unknown, capacity: number): unknown {
  return isPgError(error, CHECK_VIOLATION, CAPACITY_CONSTRAINT)
    ? new SessionFullError({ kind: 'refuse', reason: 'session_full', capacity })
    : error;
}

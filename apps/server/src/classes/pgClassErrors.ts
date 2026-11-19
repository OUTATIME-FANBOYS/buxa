import { SessionFullError } from './errors';

/*
 * Driver errors never leave the adapter. The capacity trigger in migration 0008 raises a named check violation when a
 * session is full; it is the one database error that means a business refusal, so it is the one translated here.
 */

const CHECK_VIOLATION = '23514';
export const CAPACITY_CONSTRAINT = 'enrolments_capacity';

/** True for a Postgres error with this SQLSTATE and constraint name. Anything else (including non-errors) is false. */
function isPgError(error: unknown, code: string, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return 'code' in error && error.code === code && 'constraint' in error && error.constraint === constraint;
}

/** Turns the capacity trigger's error into a SessionFullError for `capacity`. Any other error is returned unchanged. */
export function translateCapacityError(error: unknown, capacity: number): unknown {
  return isPgError(error, CHECK_VIOLATION, CAPACITY_CONSTRAINT)
    ? new SessionFullError({ kind: 'refuse', reason: 'session_full', capacity })
    : error;
}

import { describeRefusal, type Refusal } from '@buxa/domain';
import { ClassOutsideSessionError, isClassError, isEnrolmentRefusal } from './errors';

const isOutsideSession = (e: unknown): e is ClassOutsideSessionError => isClassError(e, 'class-outside-session');

/** An expected business outcome. Permission failures are not outcomes: they throw a 403 (assertAllowed). */
export type Outcome<T> = { ok: true; value: T } | { ok: false; failure: Failure };

export type FailureReason =
  | 'class_not_found'
  | 'session_not_found'
  | 'class_outside_session'
  | 'capacity_below_enrolled'
  | 'class_has_enrolments'
  | 'enrolment_not_found'
  | 'camper_not_found'
  | 'instructor_not_found'
  | 'household_not_found'
  | 'hold_not_found'
  | 'hold_exists'
  | 'teacher_not_found'
  | Refusal['reason'];

export interface Failure {
  reason: FailureReason;
  /** Copy a person can read. Safe to show. */
  message: string;
  /** Present for enrolment refusals, so a screen can offer the next step (waitlist, override, the clashing session). */
  refusal?: Refusal;
}

export const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });

const NOT_FOUND: Record<
  | 'class-not-found'
  | 'session-not-found'
  | 'enrolment-not-found'
  | 'camper-not-found'
  | 'instructor-not-found'
  | 'household-not-found'
  | 'hold-not-found'
  | 'teacher-not-found',
  Failure
> = {
  'household-not-found': { reason: 'household_not_found', message: 'That household does not exist in this camp.' },
  'hold-not-found': { reason: 'hold_not_found', message: 'That hold no longer exists, or it has been released.' },
  'teacher-not-found': { reason: 'teacher_not_found', message: 'One of the teachers is not a teacher in this camp.' },
  'class-not-found': { reason: 'class_not_found', message: 'That class no longer exists.' },
  'session-not-found': { reason: 'session_not_found', message: 'That session no longer exists.' },
  'enrolment-not-found': {
    reason: 'enrolment_not_found',
    message: 'That enrolment does not exist, or it is already cancelled.',
  },
  'camper-not-found': { reason: 'camper_not_found', message: 'That camper does not exist in this camp.' },
  'instructor-not-found': {
    reason: 'instructor_not_found',
    message: 'One of the instructors does not exist in this camp.',
  },
};

/**
 * Runs one repository call and turns the expected errors into outcomes. Anything else is unexpected and is rethrown.
 * `timeZone` is the camp's zone, used only to word a refusal.
 */
export async function attempt<T>(work: () => Promise<T>, timeZone: string): Promise<Outcome<T>> {
  try {
    return ok(await work());
  } catch (e) {
    for (const kind of Object.keys(NOT_FOUND) as (keyof typeof NOT_FOUND)[]) {
      if (isClassError(e, kind)) {
        return { ok: false, failure: NOT_FOUND[kind] };
      }
    }
    if (isOutsideSession(e)) {
      const { startsOn, endsOn } = e;

      return {
        ok: false,
        failure: {
          reason: 'class_outside_session',
          message: `The class must fall on days between ${startsOn} and ${endsOn}, the session's first and last day.`,
        },
      };
    }
    if (isClassError(e, 'capacity-below-enrolled')) {
      return {
        ok: false,
        failure: {
          reason: 'capacity_below_enrolled',
          message: 'The camp size cannot go below the places already taken.',
        },
      };
    }
    if (isClassError(e, 'class-has-enrolments')) {
      return {
        ok: false,
        failure: {
          reason: 'class_has_enrolments',
          message: 'This class has enrolments, so it cannot be deleted. Cancel them first.',
        },
      };
    }
    if (isClassError(e, 'hold-exists')) {
      return {
        ok: false,
        failure: { reason: 'hold_exists', message: 'This family already holds a place in this session.' },
      };
    }
    if (isEnrolmentRefusal(e)) {
      return {
        ok: false,
        failure: { reason: e.refusal.reason, message: describeRefusal(e.refusal, timeZone), refusal: e.refusal },
      };
    }
    throw e;
  }
}

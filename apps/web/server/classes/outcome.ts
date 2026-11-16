import { describeRefusal, type Refusal } from '@buxa/domain';
import { isClassError, isEnrolmentRefusal } from './errors';

/** An expected business outcome. Permission failures are not outcomes: they throw a 403 (assertAllowed). */
export type Outcome<T> = { ok: true; value: T } | { ok: false; failure: Failure };

export type FailureReason =
  | 'class_not_found' | 'session_not_found' | 'enrolment_not_found' | 'camper_not_found' | 'instructor_not_found'
  | Refusal['reason'];

export interface Failure {
  reason: FailureReason;
  /** Copy a person can read. Safe to show. */
  message: string;
  /** Present for enrolment refusals, so a screen can offer the next step (waitlist, override, the clashing session). */
  refusal?: Refusal;
}

export const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });

const NOT_FOUND: Record<'class-not-found' | 'session-not-found' | 'enrolment-not-found' | 'camper-not-found' | 'instructor-not-found', Failure> = {
  'class-not-found': { reason: 'class_not_found', message: 'That class no longer exists.' },
  'session-not-found': { reason: 'session_not_found', message: 'That session no longer exists.' },
  'enrolment-not-found': { reason: 'enrolment_not_found', message: 'That enrolment does not exist, or it is already cancelled.' },
  'camper-not-found': { reason: 'camper_not_found', message: 'That camper does not exist in this camp.' },
  'instructor-not-found': { reason: 'instructor_not_found', message: 'One of the instructors does not exist in this camp.' },
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
      if (isClassError(e, kind)) return { ok: false, failure: NOT_FOUND[kind] };
    }
    if (isEnrolmentRefusal(e)) {
      return { ok: false, failure: { reason: e.refusal.reason, message: describeRefusal(e.refusal, timeZone), refusal: e.refusal } };
    }
    throw e;
  }
}

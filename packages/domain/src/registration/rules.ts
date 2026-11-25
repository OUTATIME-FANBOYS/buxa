/**
 * Registration rules that need no database: when a form accepts a registration, and which sessions a registration may ask for.
 * Pure: the service passes the facts in, the rule answers. Money is not part of this phase (see docs/phases/03-registration.md).
 */

import { overlaps, type Span } from '../classes/interval';

export type RegistrationRefusal =
  | 'form_not_published'
  | 'no_sessions'
  | 'session_not_in_form'
  | 'session_not_open'
  | 'already_withdrawn'
  | 'withdraw_first'
  | 'not_pending'
  | 'already_confirmed'
  | 'no_classes'
  | 'duplicate_selection'
  | 'classes_overlap'
  | 'class_not_in_form'
  | 'camper_no_household'
  | 'class_refused'
  | 'payment_note_required'
  | 'form_has_registrations';

/** One child and one class the family asks for. `startsAt`/`endsAt` are the class's times (ISO instants). */
export interface ClassSelection extends Span {
  camperId: string;
  classId: string;
  className: string;
}

export type SelectionDecision =
  | { allow: true }
  | { allow: false; reason: 'no_classes' }
  | { allow: false; reason: 'duplicate_selection'; selection: ClassSelection }
  | { allow: false; reason: 'classes_overlap'; first: ClassSelection; second: ClassSelection };

/**
 * A child may take several classes in one registration only when their times do not overlap (owner decision). Two selections of
 * the same class for the same child are a duplicate. Classes of different children never clash with each other.
 */
export function decideSelections(selections: readonly ClassSelection[]): SelectionDecision {
  if (selections.length === 0) {
    return { allow: false, reason: 'no_classes' };
  }
  const seen = new Set<string>();
  for (const selection of selections) {
    const key = `${selection.camperId}|${selection.classId}`;
    if (seen.has(key)) {
      return { allow: false, reason: 'duplicate_selection', selection };
    }
    seen.add(key);
  }
  for (let i = 0; i < selections.length; i++) {
    for (let j = i + 1; j < selections.length; j++) {
      const a = selections[i];
      const b = selections[j];
      if (a.camperId === b.camperId && overlaps(a, b)) {
        return { allow: false, reason: 'classes_overlap', first: a, second: b };
      }
    }
  }

  return { allow: true };
}

/** A registration is recorded as pending and becomes confirmed only by a staff action (decision 3 in docs/phases/03-registration.md). */
export type RegistrationStatus = 'pending' | 'confirmed' | 'withdrawn';

export type RegistrationDecision = { allow: true } | { allow: false; reason: RegistrationRefusal };

export interface RegistrationFacts {
  /** The published version, or null when the form has never been published. */
  publishedVersion: number | null;
  /** The sessions the form covers (the session set). */
  formSessionIds: readonly string[];
  /** The sessions the family asked for. */
  requestedSessionIds: readonly string[];
  /** Sessions of the form that are not live (a draft, or archived): they take no registrations. */
  closedSessionIds: readonly string[];
}

/** A registration needs a published form, at least one session, and every requested session inside the form's session set. */
export function decideRegistration(facts: RegistrationFacts): RegistrationDecision {
  if (facts.publishedVersion === null) {
    return { allow: false, reason: 'form_not_published' };
  }
  const requested = [...new Set(facts.requestedSessionIds)];
  if (requested.length === 0) {
    return { allow: false, reason: 'no_sessions' };
  }
  const allowed = new Set(facts.formSessionIds);
  if (!requested.every(id => allowed.has(id))) {
    return { allow: false, reason: 'session_not_in_form' };
  }
  const closed = new Set(facts.closedSessionIds);
  if (requested.some(id => closed.has(id))) {
    return { allow: false, reason: 'session_not_open' };
  }

  return { allow: true };
}

/** Only a pending registration may be confirmed. A confirmed one is refused again, so a second confirmation writes nothing. */
export function decideConfirmation(status: RegistrationStatus): RegistrationDecision {
  if (status === 'confirmed') {
    return { allow: false, reason: 'already_confirmed' };
  }

  return status === 'pending' ? { allow: true } : { allow: false, reason: 'not_pending' };
}

/** A registration can be withdrawn once. Withdrawing keeps the record, releases its holds and cancels its enrolments. */
export function decideWithdrawal(status: RegistrationStatus): RegistrationDecision {
  return status === 'withdrawn' ? { allow: false, reason: 'already_withdrawn' } : { allow: true };
}

/**
 * A registration may be erased only when no enrolment stands behind it. A confirmed registration that still has an enrolment (or a
 * waitlist place) must be withdrawn first, so the seats it holds are given back before its record is removed.
 */
export function decideErasure(facts: { status: RegistrationStatus; activeEnrolments: number }): RegistrationDecision {
  if (facts.status === 'confirmed' && facts.activeEnrolments > 0) {
    return { allow: false, reason: 'withdraw_first' };
  }

  return { allow: true };
}

/** The copy a person sees when a form with registrations is refused. The UI shows the same sentence before the server answers. */
export const FORM_HAS_REGISTRATIONS_MESSAGE = 'This form has registrations, so it cannot be deleted.';

/**
 * A form may be deleted only when no registration names it, in any status (confirmed, pending, withdrawn or archived). A form with
 * registrations keeps its versions, which the answers were checked against, so the record is never lost by a delete.
 */
export function decideFormDeletion(facts: { registrationCount: number }): RegistrationDecision {
  if (facts.registrationCount > 0) {
    return { allow: false, reason: 'form_has_registrations' };
  }

  return { allow: true };
}

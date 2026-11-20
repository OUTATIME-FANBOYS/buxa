/**
 * Registration rules that need no database: when a form accepts a registration, and which sessions a registration may ask for.
 * Pure: the service passes the facts in, the rule answers. Money is not part of this phase (see docs/phases/03-registration.md).
 */

export type RegistrationRefusal =
  'form_not_published' | 'no_sessions' | 'session_not_in_form' | 'not_pending' | 'already_confirmed';

/** A registration is recorded as pending and becomes confirmed only by a staff action (decision 3 in docs/phases/03-registration.md). */
export type RegistrationStatus = 'pending' | 'confirmed';

export type RegistrationDecision = { allow: true } | { allow: false; reason: RegistrationRefusal };

export interface RegistrationFacts {
  /** The published version, or null when the form has never been published. */
  publishedVersion: number | null;
  /** The sessions the form covers (the session set). */
  formSessionIds: readonly string[];
  /** The sessions the family asked for. */
  requestedSessionIds: readonly string[];
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

  return { allow: true };
}

/** Only a pending registration may be confirmed. A confirmed one is refused again, so a second confirmation writes nothing. */
export function decideConfirmation(status: RegistrationStatus): RegistrationDecision {
  if (status === 'confirmed') {
    return { allow: false, reason: 'already_confirmed' };
  }

  return status === 'pending' ? { allow: true } : { allow: false, reason: 'not_pending' };
}

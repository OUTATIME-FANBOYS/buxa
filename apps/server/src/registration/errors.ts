import type { RegistrationRefusal } from '@buxa/domain';

/*
 * Domain errors for registration forms and submissions. Adapters throw these; the service turns them into outcomes or messages.
 * Recognised by `kind`, never `instanceof`, because Next.js can load a module more than once (see server/http/errors.ts).
 */

export class RegistrationFormNotFoundError extends Error {
  readonly kind = 'registration-form-not-found';
  constructor() {
    super('That registration form does not exist in this camp.');
    this.name = 'RegistrationFormNotFoundError';
  }
}

/** A registration id that is not in this camp. */
export class RegistrationNotFoundError extends Error {
  readonly kind = 'registration-not-found';
  constructor() {
    super('That registration does not exist in this camp.');
    this.name = 'RegistrationNotFoundError';
  }
}

/** A session named by a form is not in this camp. */
export class RegistrationSessionNotFoundError extends Error {
  readonly kind = 'registration-session-not-found';
  constructor() {
    super('One of the sessions does not exist in this camp.');
    this.name = 'RegistrationSessionNotFoundError';
  }
}

/** A registration the domain rule refused (unpublished form, no session, a session outside the form). Nothing is written. */
export class RegistrationRefusedError extends Error {
  readonly kind = 'registration-refused';
  constructor(readonly reason: RegistrationRefusal) {
    super(REFUSAL_MESSAGES[reason]);
    this.name = 'RegistrationRefusedError';
  }
}

export const REFUSAL_MESSAGES: Record<RegistrationRefusal, string> = {
  form_not_published: 'Publish this form before taking registrations on it.',
  no_sessions: 'Choose at least one session.',
  session_not_in_form: 'One of the sessions is not part of this form.',
  not_pending: 'Only a pending registration can be confirmed.',
  already_confirmed: 'This registration is already confirmed.',
};

/** The submitted answers do not match the form version. `fieldErrors` is keyed by field name (for example `standard.guardianPhone`). */
export class RegistrationInvalidError extends Error {
  readonly kind = 'registration-invalid';
  constructor(readonly fieldErrors: Record<string, string>) {
    super('Check the answers highlighted below.');
    this.name = 'RegistrationInvalidError';
  }
}

export type RegistrationErrorKind =
  | 'registration-form-not-found'
  | 'registration-session-not-found'
  | 'registration-not-found'
  | 'registration-refused'
  | 'registration-invalid';

export const isRegistrationError = (e: unknown, kind: RegistrationErrorKind): boolean =>
  e instanceof Error && 'kind' in e && e.kind === kind;

/** Narrows to the invalid-answers error, whose field errors the form shows. */
export const isRegistrationInvalid = (e: unknown): e is RegistrationInvalidError =>
  isRegistrationError(e, 'registration-invalid');

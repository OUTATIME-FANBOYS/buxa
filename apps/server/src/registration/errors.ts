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

/** A class place named by a payment is not in this camp. */
export class RegistrationClassNotFoundError extends Error {
  readonly kind = 'registration-class-not-found';
  constructor() {
    super('That place in the registration does not exist in this camp.');
    this.name = 'RegistrationClassNotFoundError';
  }
}

/**
 * A registration the domain rule refused (unpublished form, no class, a class outside the form, two clashing classes). Nothing is
 * written. `message` overrides the standard copy, for a refusal that names people or classes (a clash, a full age range).
 */
export class RegistrationRefusedError extends Error {
  readonly kind = 'registration-refused';
  constructor(
    readonly reason: RegistrationRefusal,
    message?: string,
  ) {
    super(message ?? REFUSAL_MESSAGES[reason]);
    this.name = 'RegistrationRefusedError';
  }
}

export const REFUSAL_MESSAGES: Record<RegistrationRefusal, string> = {
  form_not_published: 'Publish this form before taking registrations on it.',
  no_sessions: 'Choose at least one session.',
  session_not_in_form: 'One of the sessions is not part of this form.',
  session_not_open:
    'One of the sessions is not open for registration. A draft session must go live first, and an archived one is closed.',
  already_withdrawn: 'This registration is already withdrawn.',
  withdraw_first:
    'This registration is confirmed and still has enrolments. Withdraw it first, which cancels them, then delete it.',
  not_pending: 'Only a pending registration can be confirmed.',
  already_confirmed: 'This registration is already confirmed.',
  no_classes: 'Choose at least one class.',
  duplicate_selection: 'That child is already chosen for this class.',
  classes_overlap: 'Those classes overlap for this child. Choose one of them.',
  class_not_in_form: 'One of the classes is not part of this form.',
  camper_no_household: 'That child is not in a household yet. Add them to a household in People first.',
  class_refused: 'One of the places cannot be taken.',
  payment_note_required: 'Add a note saying how it was paid, such as the date and the method.',
};

/**
 * A file that is not in this camp, or that a download may not reach: a form attachment for a session its form does not cover, or
 * a document of another camp. The same message for each, so the response does not show which one it was.
 */
export class RegistrationFileNotFoundError extends Error {
  readonly kind = 'registration-file-not-found';
  constructor() {
    super('That file is not available.');
    this.name = 'RegistrationFileNotFoundError';
  }
}

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
  | 'registration-invalid'
  | 'registration-class-not-found'
  | 'registration-file-not-found';

export const isRegistrationError = (e: unknown, kind: RegistrationErrorKind): boolean =>
  e instanceof Error && 'kind' in e && e.kind === kind;

/** Narrows to the invalid-answers error, whose field errors the form shows. */
export const isRegistrationInvalid = (e: unknown): e is RegistrationInvalidError =>
  isRegistrationError(e, 'registration-invalid');

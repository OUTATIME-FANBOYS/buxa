import type { Actor, RegistrationDecision, RegistrationFacts } from '@buxa/domain';
import type { CustomField, RegistrationForm, RegistrationFormInput, RegistrationRow } from '@buxa/contracts';

/** The published definitions a submission is checked against. */
export interface PublishedVersion {
  version: number;
  fields: CustomField[];
}

/** A validated submission, ready to store. Answers were checked against `version` by the service. */
export interface NewRegistration {
  formId: string;
  version: number;
  sessionIds: string[];
  answers: { standard: Record<string, string>; custom: Record<string, string | boolean> };
}

/** The facts the rule needs, gathered inside the transaction. The service adds the requested sessions. */
export type RegistrationFactsInTx = Omit<RegistrationFacts, 'requestedSessionIds'>;

/** Pure: the service passes the domain rule, nothing else. Runs under the form's row lock. */
export type RegistrationRule = (facts: RegistrationFactsInTx) => RegistrationDecision;

/**
 * Storage for registration forms and submissions. Callers decide whether something may happen (permissions, rules in
 * @buxa/domain); implementations persist it and audit it in the same transaction. Every method is scoped to the actor's camp.
 * Holds and the waitlist are not here yet: they add a status on registration_sessions (see migration 0023).
 */
export interface RegistrationRepository {
  listForms(orgId: string): Promise<RegistrationForm[]>;
  getForm(orgId: string, formId: string): Promise<RegistrationForm | null>;
  /** The published definitions of a form, or null when the form is missing or never published. */
  getPublishedVersion(orgId: string, formId: string): Promise<PublishedVersion | null>;
  /** Audits `registration_form.create`. Throws RegistrationSessionNotFoundError for a session outside the camp. */
  createForm(actor: Actor, input: RegistrationFormInput): Promise<RegistrationForm>;
  /** Audits `registration_form.update`. Throws RegistrationFormNotFoundError or RegistrationSessionNotFoundError. */
  updateForm(actor: Actor, formId: string, input: RegistrationFormInput): Promise<RegistrationForm>;
  /** Freezes the draft as the next version. Audits `registration_form.publish`. Throws RegistrationFormNotFoundError. */
  publishForm(actor: Actor, formId: string): Promise<RegistrationForm>;
  /** Throws RegistrationFormNotFoundError. */
  listSubmissions(orgId: string, formId: string): Promise<RegistrationRow[]>;
  /**
   * Checks the rule inside the transaction and, on allow, writes the registration, its session rows and `registration.submit`.
   * On refuse it throws RegistrationRefusedError and writes nothing. Throws RegistrationFormNotFoundError.
   */
  submit(actor: Actor, registration: NewRegistration, rule: RegistrationRule): Promise<string>;
}

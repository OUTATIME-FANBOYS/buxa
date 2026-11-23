import type { Actor, RegistrationDecision, RegistrationFacts, RegistrationStatus } from '@buxa/domain';
import type { CustomField, RegistrationForm, RegistrationFormInput, RegistrationRow } from '@buxa/contracts';
import type { CredentialRepository } from '../credentials/CredentialRepository';

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

/** Pure: decides from the registration's current status whether it may be confirmed (decideConfirmation). Runs under the row lock. */
export type ConfirmationRule = (status: RegistrationStatus) => RegistrationDecision;

/**
 * What a confirmation can reach while its transaction is open. Badges are written here, so a confirmation and the badges it
 * issues commit together or not at all.
 */
export interface ConfirmationUnit {
  /** The people the registration names as campers: active, with the camper role, matching the camper's name and birth date. */
  campers(): Promise<string[]>;
  /** The badge repository inside the same transaction. Pass it to the credentials service. */
  credentials: CredentialRepository;
}

/** The work a confirmation runs inside its transaction. Its result is returned to the caller. */
export type ConfirmationWork<T> = (unit: ConfirmationUnit) => Promise<T>;

/**
 * Storage for registration forms and submissions. Callers decide whether something may happen (permissions, rules in
 * @buxa/domain); implementations persist it and audit it in the same transaction. Every method is scoped to the actor's camp.
 * Holds and the waitlist are not here yet: they add a status on registration_sessions (see migration 0023).
 */
export interface RegistrationRepository {
  listForms(userId: string, orgId: string): Promise<RegistrationForm[]>;
  getForm(userId: string, orgId: string, formId: string): Promise<RegistrationForm | null>;
  /** The published definitions of a form, or null when the form is missing or never published. */
  getPublishedVersion(userId: string, orgId: string, formId: string): Promise<PublishedVersion | null>;
  /** Audits `registration_form.create`. Throws RegistrationSessionNotFoundError for a session outside the camp. */
  createForm(actor: Actor, input: RegistrationFormInput): Promise<RegistrationForm>;
  /** Audits `registration_form.update`. Throws RegistrationFormNotFoundError or RegistrationSessionNotFoundError. */
  updateForm(actor: Actor, formId: string, input: RegistrationFormInput): Promise<RegistrationForm>;
  /** Freezes the draft as the next version. Audits `registration_form.publish`. Throws RegistrationFormNotFoundError. */
  publishForm(actor: Actor, formId: string): Promise<RegistrationForm>;
  /** Throws RegistrationFormNotFoundError. */
  listSubmissions(userId: string, orgId: string, formId: string): Promise<RegistrationRow[]>;
  /**
   * Checks the rule inside the transaction and, on allow, writes the registration, its session rows and `registration.submit`.
   * On refuse it throws RegistrationRefusedError and writes nothing. Throws RegistrationFormNotFoundError.
   */
  submit(actor: Actor, registration: NewRegistration, rule: RegistrationRule): Promise<string>;
  /**
   * Locks the registration, checks the rule on its status and, on allow, sets it confirmed, audits `registration.confirm` and then
   * runs `work` in the same transaction. On refuse it throws RegistrationRefusedError and writes nothing. Throws
   * RegistrationNotFoundError. Returns what `work` returns.
   */
  confirm<T>(actor: Actor, registrationId: string, rule: ConfirmationRule, work: ConfirmationWork<T>): Promise<T>;
}

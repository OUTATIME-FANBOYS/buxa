import type {
  Actor,
  AttachmentContentType,
  ClassSelection,
  DocumentReviewStatus,
  RegistrationDecision,
  RegistrationFacts,
  RegistrationStatus,
} from '@buxa/domain';
import type {
  DocumentAnswer,
  PublishedForm,
  RegistrationForm,
  RegistrationFormInput,
  RegistrationRow,
} from '@buxa/contracts';
import type { CredentialRepository } from '../credentials/CredentialRepository';

/** A file the service has checked and is about to store: its id (made by the service), name, type and bytes. */
export interface StoredFileInput {
  id: string;
  name: string;
  contentType: AttachmentContentType;
  bytes: Uint8Array;
}

/** A document question's file on a submission. */
export interface NewDocument extends StoredFileInput {
  fieldKey: string;
}

/** A stored file read back for a download. `bytes` never leaves the server except through a download route. */
export interface FileDownload {
  id: string;
  name: string;
  contentType: string;
  bytes: Uint8Array;
}

/** The published definitions a submission is checked against. */
/** The published version a family registers on: its name, season, sessions and questions (see PublishedForm in contracts). */
export type PublishedVersion = PublishedForm;

/** A class of the camp as a registration reads it: its parent session, its name and its times. */
export interface ClassLookup {
  classId: string;
  sessionId: string;
  className: string;
  startsAt: string;
  endsAt: string;
}

/**
 * A validated submission, ready to store. Answers were checked against `version` by the service. `selections` are the child and
 * class pairs, each with the class's facts; `sessionIds` are the parent sessions of those classes (derived, never typed).
 */
export interface NewRegistration {
  formId: string;
  version: number;
  sessionIds: string[];
  selections: (ClassSelection & { camperId: string })[];
  answers: { standard: Record<string, string>; custom: Record<string, string | boolean | DocumentAnswer> };
  /** The files for the document questions, one per question given. Stored with the registration, in the same transaction. */
  documents: NewDocument[];
}

/** Pure: decides from the number of registrations that name a form whether it may be deleted (decideFormDeletion). Runs under the row lock. */
export type FormDeletionRule = (facts: { registrationCount: number }) => RegistrationDecision;

/** The facts the rule needs, gathered inside the transaction. The service adds the requested sessions. */
export type RegistrationFactsInTx = Omit<RegistrationFacts, 'requestedSessionIds'>;

/** Pure: the service passes the domain rule, nothing else. Runs under the form's row lock. */
export type RegistrationRule = (facts: RegistrationFactsInTx) => RegistrationDecision;

/** Pure: decides from the registration's current status whether it may be confirmed (decideConfirmation). Runs under the row lock. */
export type ConfirmationRule = (status: RegistrationStatus) => RegistrationDecision;

/** Pure: decides from the registration's current status whether it may be withdrawn (decideWithdrawal). Runs under the row lock. */
export type WithdrawalRule = (status: RegistrationStatus) => RegistrationDecision;

/** Pure: decides from the status and the number of active enrolments whether it may be erased (decideErasure). Runs under the row lock. */
export type ErasureRule = (facts: { status: RegistrationStatus; activeEnrolments: number }) => RegistrationDecision;

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
 * A registration's sessions are derived from its places (registration_classes to sessions to classes); registration_sessions is no
 * longer written (migration 0054 note).
 */
export interface RegistrationRepository {
  listForms(userId: string, orgId: string): Promise<RegistrationForm[]>;
  getForm(userId: string, orgId: string, formId: string): Promise<RegistrationForm | null>;
  /** The published definitions of a form, or null when the form is missing or never published. */
  getPublishedVersion(userId: string, orgId: string, formId: string): Promise<PublishedVersion | null>;
  /** Audits `registration_form.create`. Throws RegistrationSessionNotFoundError for a session outside the camp. */
  /** Files in `files` are attached to the new form in the same transaction. Audits `registration_form.file_add` for each. */
  createForm(actor: Actor, input: RegistrationFormInput, files: readonly StoredFileInput[]): Promise<RegistrationForm>;
  /** Removes an attachment of a form. Audits `registration_form.file_remove`. Throws RegistrationFileNotFoundError. */
  removeFormFile(actor: Actor, formId: string, fileId: string): Promise<void>;
  /**
   * Locks the form, counts the registrations that name it, checks the rule and, on allow, deletes the form with its versions, its
   * covered sessions and its attachments. Audits `registration_form.delete` in the same transaction. Throws
   * RegistrationFormNotFoundError, or RegistrationRefusedError (form_has_registrations) with nothing written.
   */
  deleteForm(actor: Actor, formId: string, rule: FormDeletionRule): Promise<void>;
  /**
   * A form attachment, only when its form covers `sessionId` (the session the family is registering for). Null otherwise: a file of
   * another camp, of another form or for a session the form does not cover.
   */
  formFileDownload(userId: string, orgId: string, fileId: string, sessionId: string): Promise<FileDownload | null>;
  /** A document a family sent, or null when the file is not in this camp. */
  documentDownload(userId: string, orgId: string, fileId: string): Promise<FileDownload | null>;
  /**
   * Sets a document's review, and the status in the answer that names it, in one statement. Audits `registration.document_review`.
   * Throws RegistrationFileNotFoundError.
   */
  setDocumentReview(actor: Actor, fileId: string, status: DocumentReviewStatus): Promise<void>;
  /** Audits `registration_form.update`. Throws RegistrationFormNotFoundError or RegistrationSessionNotFoundError. */
  updateForm(
    actor: Actor,
    formId: string,
    input: RegistrationFormInput,
    files: readonly StoredFileInput[],
  ): Promise<RegistrationForm>;
  /** Freezes the draft as the next version. Audits `registration_form.publish`. Throws RegistrationFormNotFoundError. */
  publishForm(actor: Actor, formId: string): Promise<RegistrationForm>;
  /** The classes of the camp among `classIds`, with their parent session. A class outside the camp is simply absent. */
  classesFor(userId: string, orgId: string, classIds: readonly string[]): Promise<ClassLookup[]>;
  /** Throws RegistrationFormNotFoundError. */
  listSubmissions(userId: string, orgId: string, formId: string): Promise<RegistrationRow[]>;
  /**
   * Checks the rule inside the transaction and, on allow, writes the registration, its session rows and `registration.submit`.
   * On refuse it throws RegistrationRefusedError and writes nothing. Throws RegistrationFormNotFoundError.
   */
  submit(actor: Actor, registration: NewRegistration, rule: RegistrationRule): Promise<string>;
  /**
   * Records a child-and-class place for a registration. Its payment is recorded by hand (unpaid, or paid with a note). Audits
   * `registration.payment`. Throws RegistrationClassNotFoundError when the place is not in this camp.
   */
  recordPayment(
    actor: Actor,
    registrationClassId: string,
    input: { paid: boolean; note: string | null },
  ): Promise<void>;
  /**
   * Locks the registration, checks the rule on its status and, on allow, sets it confirmed, audits `registration.confirm` and then
   * runs `work` in the same transaction. On refuse it throws RegistrationRefusedError and writes nothing. Throws
   * RegistrationNotFoundError. Returns what `work` returns.
   */
  confirm<T>(actor: Actor, registrationId: string, rule: ConfirmationRule, work: ConfirmationWork<T>): Promise<T>;
  /**
   * Locks the registration, checks the rule on its status and, on allow, releases its holds, cancels its enrolments (the existing
   * cancel path, so the waitlist moves up) and marks it withdrawn. The record and its answers stay. Audits `registration.withdraw`.
   * Throws RegistrationNotFoundError, or RegistrationRefusedError.
   */
  withdraw(actor: Actor, registrationId: string, rule: WithdrawalRule): Promise<void>;
  /** Hides a registration from lists (`archived` true) or brings it back. It is kept. Audits `registration.archive` or `registration.unarchive`. Throws RegistrationNotFoundError. */
  setArchived(actor: Actor, registrationId: string, archived: boolean): Promise<void>;
  /**
   * Erases a registration and all its answers. Checks the rule first (a confirmed registration with enrolments is refused:
   * withdraw it first). Audits `registration.delete` without personal data. Throws RegistrationNotFoundError, or RegistrationRefusedError.
   */
  erase(actor: Actor, registrationId: string, rule: ErasureRule): Promise<void>;
}

import { randomUUID } from 'node:crypto';
import { formDraftDiffers, type Actor, type DocumentReviewStatus, type RegistrationStatus } from '@buxa/domain';
import type { FormAttachment } from '@buxa/contracts';
import { documentRowsFor } from './documentRows';
import type {
  CustomField,
  RegistrationClass,
  RegistrationForm,
  RegistrationFormInput,
  RegistrationRow,
} from '@buxa/contracts';
import {
  RegistrationClassNotFoundError,
  RegistrationFileNotFoundError,
  RegistrationFormNoSessionsError,
  RegistrationFormNotFoundError,
  RegistrationNotFoundError,
  RegistrationRefusedError,
  RegistrationSessionNotFoundError,
} from './errors';
import type { CredentialRepository } from '../credentials/CredentialRepository';
import type {
  ClassLookup,
  ConfirmationRule,
  ConfirmationWork,
  ErasureRule,
  FileDownload,
  FormDeletionRule,
  NewDocument,
  NewRegistration,
  PublishedVersion,
  StoredFileInput,
  RegistrationRepository,
  RegistrationRule,
  WithdrawalRule,
} from './RegistrationRepository';

/** A child's place in a class, as the in-memory store keeps it. Holds and seats are not modelled here (see the Postgres tests). */
interface StoredPlace {
  id: string;
  classId: string;
  className: string;
  sessionId: string;
  camperId: string;
  status: RegistrationClass['status'];
  paymentStatus: 'unpaid' | 'paid';
  paymentNote: string | null;
  price: RegistrationClass['price'];
}

/** The draft of a form: what staff last saved. Only a publish copies it into a version (families read the versions). */
interface FormDraft {
  name: string;
  season: string | null;
  sessionIds: string[];
  fields: CustomField[];
}

interface StoredForm {
  id: string;
  orgId: string;
  draft: FormDraft;
  /** Published versions, oldest first. The last one is what families register on. */
  versions: PublishedVersion[];
  updatedAt: string;
  attachments: (StoredFileInput & { formId: string })[];
}

/** The session ids families may register for: the last published version's, or none before the first publish. */
function publishedSessionIds(form: StoredForm): string[] {
  return form.versions.at(-1)?.sessions.map(s => s.id) ?? [];
}

interface StoredRegistration {
  id: string;
  orgId: string;
  formId: string;
  version: number;
  sessionIds: string[];
  answers: NewRegistration['answers'];
  createdAt: string;
  status: RegistrationStatus;
  confirmedAt: string | null;
  withdrawnAt: string | null;
  archivedAt: string | null;
  places: StoredPlace[];
  documents: NewDocument[];
}

/** Runs the work now and settles the promise with its result, or rejects it with what it throws. Same contract as the adapter. */
const later = <T>(work: () => T): Promise<T> => new Promise<T>(resolve => resolve(work()));

/**
 * An in-memory registration store for tests that run without a database. It keeps the same rules as the Postgres adapter: every
 * call is scoped to one camp, a session must belong to the camp, and a refused registration writes nothing.
 * `campSessions` lists the session ids that exist in each camp (the sessions table in production).
 */
export class InMemoryRegistrationRepository implements RegistrationRepository {
  private readonly forms = new Map<string, StoredForm>();
  private readonly registrations = new Map<string, StoredRegistration>();

  /** Test setup: the sessions that are a draft or archived. A submission that names one is refused (session_not_open). */
  readonly closedSessionIds = new Set<string>();

  /**
   * `campersOf` finds the camper people for a registration's answers (the Postgres query in production). `credentials` is the badge
   * repository a confirmation works with.
   */
  constructor(
    private readonly campSessions: Record<string, string[]>,
    private readonly campersOf: (orgId: string, answers: NewRegistration['answers']) => string[] = () => [],
    private readonly credentials: CredentialRepository | null = null,
    /** The classes of each camp, for the class lookups a submission makes. */
    private readonly campClasses: Record<string, ClassLookup[]> = {},
  ) {}

  classesFor(userId: string, orgId: string, classIds: readonly string[]): Promise<ClassLookup[]> {
    return later(() => (this.campClasses[orgId] ?? []).filter(c => classIds.includes(c.classId)));
  }

  recordPayment(
    actor: Actor,
    registrationClassId: string,
    input: { paid: boolean; note: string | null },
  ): Promise<void> {
    return later(() => {
      for (const registration of this.registrations.values()) {
        if (registration.orgId !== actor.orgId) {
          continue;
        }
        const place = registration.places.find(p => p.id === registrationClassId);
        if (place) {
          place.paymentStatus = input.paid ? 'paid' : 'unpaid';
          place.paymentNote = input.note;

          return;
        }
      }
      throw new RegistrationClassNotFoundError();
    });
  }

  private ownForm(orgId: string, formId: string): StoredForm {
    const form = this.forms.get(formId);
    if (!form || form.orgId !== orgId) {
      throw new RegistrationFormNotFoundError();
    }

    return form;
  }

  private requireSessions(orgId: string, sessionIds: string[]): void {
    const known = new Set(this.campSessions[orgId] ?? []);
    if (!sessionIds.every(id => known.has(id))) {
      throw new RegistrationSessionNotFoundError();
    }
  }

  private view(form: StoredForm): RegistrationForm {
    const submissionCount = [...this.registrations.values()].filter(r => r.formId === form.id).length;

    const latest = form.versions.at(-1) ?? null;
    const draft = form.draft;

    return {
      id: form.id,
      name: draft.name,
      season: draft.season,
      sessions: [...draft.sessionIds].sort().map(id => ({ id, name: id })),
      fields: draft.fields,
      attachments: form.attachments.map(toAttachment),
      publishedVersion: latest?.version ?? null,
      published: latest,
      hasUnpublishedChanges:
        latest !== null &&
        formDraftDiffers(
          { name: draft.name, season: draft.season, sessionIds: draft.sessionIds, fields: draft.fields },
          {
            name: latest.name,
            season: latest.season,
            sessionIds: latest.sessions.map(s => s.id),
            fields: latest.fields,
          },
        ),
      submissionCount,
      updatedAt: form.updatedAt,
    };
  }

  listForms(userId: string, orgId: string): Promise<RegistrationForm[]> {
    return later(() => [...this.forms.values()].filter(f => f.orgId === orgId).map(f => this.view(f)));
  }

  getForm(userId: string, orgId: string, formId: string): Promise<RegistrationForm | null> {
    return later(() => {
      const form = this.forms.get(formId);

      return form && form.orgId === orgId ? this.view(form) : null;
    });
  }

  getPublishedVersion(userId: string, orgId: string, formId: string): Promise<PublishedVersion | null> {
    return later(() => {
      const form = this.forms.get(formId);
      if (!form || form.orgId !== orgId) {
        return null;
      }

      return form.versions.at(-1) ?? null;
    });
  }

  createForm(actor: Actor, input: RegistrationFormInput, files: readonly StoredFileInput[]): Promise<RegistrationForm> {
    return later(() => {
      this.requireSessions(actor.orgId, input.sessionIds);
      const form: StoredForm = {
        id: randomUUID(),
        orgId: actor.orgId,
        draft: { name: input.name, season: input.season, sessionIds: input.sessionIds, fields: input.fields },
        versions: [],
        updatedAt: new Date().toISOString(),
        attachments: [],
      };
      form.attachments.push(...files.map(f => ({ ...f, formId: form.id })));
      this.forms.set(form.id, form);

      return this.view(form);
    });
  }

  updateForm(
    actor: Actor,
    formId: string,
    input: RegistrationFormInput,
    files: readonly StoredFileInput[],
  ): Promise<RegistrationForm> {
    return later(() => {
      const form = this.ownForm(actor.orgId, formId);
      this.requireSessions(actor.orgId, input.sessionIds);
      // Saving changes the draft only. The versions (what families register on) are untouched until publish.
      form.draft = { name: input.name, season: input.season, sessionIds: input.sessionIds, fields: input.fields };
      form.updatedAt = new Date().toISOString();
      form.attachments.push(...files.map(f => ({ ...f, formId })));

      return this.view(form);
    });
  }

  removeFormFile(actor: Actor, formId: string, fileId: string): Promise<void> {
    return later(() => {
      const form = this.ownForm(actor.orgId, formId);
      const before = form.attachments.length;
      form.attachments = form.attachments.filter(a => a.id !== fileId);
      if (form.attachments.length === before) {
        throw new RegistrationFileNotFoundError();
      }
    });
  }

  deleteForm(actor: Actor, formId: string, rule: FormDeletionRule): Promise<void> {
    return later(() => {
      const form = this.ownForm(actor.orgId, formId);
      const registrationCount = [...this.registrations.values()].filter(
        r => r.orgId === actor.orgId && r.formId === form.id,
      ).length;
      const decision = rule({ registrationCount });
      if (!decision.allow) {
        throw new RegistrationRefusedError(decision.reason);
      }
      this.forms.delete(form.id);
    });
  }

  formFileDownload(userId: string, orgId: string, fileId: string, sessionId: string): Promise<FileDownload | null> {
    return later(() => {
      for (const form of this.forms.values()) {
        const file = form.orgId === orgId ? form.attachments.find(a => a.id === fileId) : undefined;
        if (file && publishedSessionIds(form).includes(sessionId)) {
          return { id: file.id, name: file.name, contentType: file.contentType, bytes: file.bytes };
        }
      }

      return null;
    });
  }

  documentDownload(userId: string, orgId: string, fileId: string): Promise<FileDownload | null> {
    return later(() => {
      for (const registration of this.registrations.values()) {
        const document = registration.orgId === orgId ? registration.documents.find(d => d.id === fileId) : undefined;
        if (document) {
          return { id: document.id, name: document.name, contentType: document.contentType, bytes: document.bytes };
        }
      }

      return null;
    });
  }

  setDocumentReview(actor: Actor, fileId: string, status: DocumentReviewStatus): Promise<void> {
    return later(() => {
      for (const registration of this.registrations.values()) {
        const document =
          registration.orgId === actor.orgId ? registration.documents.find(d => d.id === fileId) : undefined;
        if (document) {
          registration.answers.custom[document.fieldKey] = { fileId, status };

          return;
        }
      }
      throw new RegistrationFileNotFoundError();
    });
  }

  publishForm(actor: Actor, formId: string): Promise<RegistrationForm> {
    return later(() => {
      const form = this.ownForm(actor.orgId, formId);
      if (form.draft.sessionIds.length === 0) {
        throw new RegistrationFormNoSessionsError();
      }
      this.requireSessions(actor.orgId, form.draft.sessionIds);
      const version = (form.versions.at(-1)?.version ?? 0) + 1;
      form.versions.push({
        version,
        name: form.draft.name,
        season: form.draft.season,
        sessions: form.draft.sessionIds.map(id => ({ id, name: id })),
        fields: form.draft.fields,
      });

      return this.view(form);
    });
  }

  listSubmissions(userId: string, orgId: string, formId: string): Promise<RegistrationRow[]> {
    return later(() => {
      const form = this.ownForm(orgId, formId);

      return [...this.registrations.values()]
        .filter(r => r.formId === formId && r.orgId === orgId)
        .map(r => ({
          id: r.id,
          formVersion: r.version,
          submittedAt: r.createdAt,
          status: r.status,
          confirmedAt: r.confirmedAt,
          withdrawnAt: r.withdrawnAt,
          archivedAt: r.archivedAt,
          standard: r.answers.standard,
          custom: r.answers.custom,
          documents: documentRowsFor(
            form.versions.find(v => v.version === r.version)?.fields ?? [],
            r.answers.custom,
            new Map(r.documents.map(d => [d.id, d.name] as const)),
          ),
          sessions: r.sessionIds.map(sessionId => ({
            sessionId,
            sessionName: sessionId,
            status: 'submitted' as const,
          })),
          classes: r.places.map(p => ({
            id: p.id,
            classId: p.classId,
            className: p.className,
            sessionId: p.sessionId,
            sessionName: p.sessionId,
            camperId: p.camperId,
            camperName: p.camperId,
            status: p.status,
            paymentStatus: p.paymentStatus,
            paymentNote: p.paymentNote,
            price: p.price,
          })),
        }));
    });
  }

  submit(actor: Actor, registration: NewRegistration, rule: RegistrationRule): Promise<string> {
    return later(() => {
      const form = this.ownForm(actor.orgId, registration.formId);
      const formSessionIds = publishedSessionIds(form);
      const decision = rule({
        publishedVersion: form.versions.at(-1)?.version ?? null,
        formSessionIds,
        closedSessionIds: formSessionIds.filter(id => this.closedSessionIds.has(id)),
      });
      if (!decision.allow) {
        throw new RegistrationRefusedError(decision.reason);
      }
      const id = randomUUID();
      const lookups = this.campClasses[actor.orgId] ?? [];
      const places: StoredPlace[] = registration.selections.map(selection => {
        const lookup = lookups.find(c => c.classId === selection.classId);

        return {
          id: randomUUID(),
          classId: selection.classId,
          className: lookup?.className ?? '',
          sessionId: lookup?.sessionId ?? '',
          camperId: selection.camperId,
          status: 'held',
          paymentStatus: 'unpaid',
          paymentNote: null,
          price: null,
        };
      });
      this.registrations.set(id, {
        id,
        orgId: actor.orgId,
        formId: form.id,
        version: registration.version,
        sessionIds: registration.sessionIds,
        answers: registration.answers,
        createdAt: new Date().toISOString(),
        status: 'pending',
        confirmedAt: null,
        withdrawnAt: null,
        archivedAt: null,
        places,
        documents: registration.documents,
      });

      return id;
    });
  }

  async confirm<T>(
    actor: Actor,
    registrationId: string,
    rule: ConfirmationRule,
    work: ConfirmationWork<T>,
  ): Promise<T> {
    const registration = await later(() => {
      const found = this.registrations.get(registrationId);
      if (!found || found.orgId !== actor.orgId) {
        throw new RegistrationNotFoundError();
      }
      const decision = rule(found.status);
      if (!decision.allow) {
        throw new RegistrationRefusedError(decision.reason);
      }

      return found;
    });
    if (!this.credentials) {
      throw new Error('InMemoryRegistrationRepository.confirm needs a credentials repository');
    }
    const before = { status: registration.status, confirmedAt: registration.confirmedAt };
    const beforePlaces = registration.places.map(p => p.status);
    registration.status = 'confirmed';
    registration.confirmedAt = new Date().toISOString();
    for (const place of registration.places) {
      if (place.status === 'held') {
        place.status = 'enrolled';
      }
    }
    try {
      return await work({
        campers: () => Promise.resolve(this.campersOf(registration.orgId, registration.answers)),
        credentials: this.credentials,
      });
    } catch (error) {
      // Postgres rolls the whole confirmation back on a failure; this keeps the in-memory store to the same rule.
      Object.assign(registration, before);
      registration.places.forEach((p, i) => {
        p.status = beforePlaces[i];
      });
      throw error;
    }
  }

  withdraw(actor: Actor, registrationId: string, rule: WithdrawalRule): Promise<void> {
    return later(() => {
      const found = this.ownRegistration(actor.orgId, registrationId);
      const decision = rule(found.status);
      if (!decision.allow) {
        throw new RegistrationRefusedError(decision.reason);
      }
      found.status = 'withdrawn';
      found.withdrawnAt = new Date().toISOString();
      for (const place of found.places) {
        place.status = place.status === 'held' ? 'expired' : 'cancelled';
      }
    });
  }

  setArchived(actor: Actor, registrationId: string, archived: boolean): Promise<void> {
    return later(() => {
      const found = this.ownRegistration(actor.orgId, registrationId);
      found.archivedAt = archived ? (found.archivedAt ?? new Date().toISOString()) : null;
    });
  }

  erase(actor: Actor, registrationId: string, rule: ErasureRule): Promise<void> {
    return later(() => {
      const found = this.ownRegistration(actor.orgId, registrationId);
      const decision = rule({
        status: found.status,
        activeEnrolments: found.places.filter(p => p.status === 'enrolled' || p.status === 'waitlisted').length,
      });
      if (!decision.allow) {
        throw new RegistrationRefusedError(decision.reason);
      }
      this.registrations.delete(found.id);
    });
  }

  private ownRegistration(orgId: string, registrationId: string): StoredRegistration {
    const found = this.registrations.get(registrationId);
    if (!found || found.orgId !== orgId) {
      throw new RegistrationNotFoundError();
    }

    return found;
  }
}

function toAttachment(file: StoredFileInput & { formId: string }): FormAttachment {
  return { id: file.id, name: file.name, contentType: file.contentType, sizeBytes: file.bytes.byteLength };
}

import { randomUUID } from 'node:crypto';
import type { Actor, RegistrationStatus } from '@buxa/domain';
import type {
  CustomField,
  RegistrationClass,
  RegistrationForm,
  RegistrationFormInput,
  RegistrationRow,
} from '@buxa/contracts';
import {
  RegistrationClassNotFoundError,
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
  NewRegistration,
  PublishedVersion,
  RegistrationRepository,
  RegistrationRule,
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
}

interface StoredForm {
  id: string;
  orgId: string;
  name: string;
  season: string | null;
  draft: CustomField[];
  sessionIds: string[];
  versions: PublishedVersion[];
  updatedAt: string;
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
  places: StoredPlace[];
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

    return {
      id: form.id,
      name: form.name,
      season: form.season,
      sessions: [...form.sessionIds].sort().map(id => ({ id, name: id })),
      fields: form.draft,
      publishedVersion: form.versions.at(-1)?.version ?? null,
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

  createForm(actor: Actor, input: RegistrationFormInput): Promise<RegistrationForm> {
    return later(() => {
      this.requireSessions(actor.orgId, input.sessionIds);
      const form: StoredForm = {
        id: randomUUID(),
        orgId: actor.orgId,
        name: input.name,
        season: input.season,
        draft: input.fields,
        sessionIds: input.sessionIds,
        versions: [],
        updatedAt: new Date().toISOString(),
      };
      this.forms.set(form.id, form);

      return this.view(form);
    });
  }

  updateForm(actor: Actor, formId: string, input: RegistrationFormInput): Promise<RegistrationForm> {
    return later(() => {
      const form = this.ownForm(actor.orgId, formId);
      this.requireSessions(actor.orgId, input.sessionIds);
      Object.assign(form, {
        name: input.name,
        season: input.season,
        draft: input.fields,
        sessionIds: input.sessionIds,
        updatedAt: new Date().toISOString(),
      });

      return this.view(form);
    });
  }

  publishForm(actor: Actor, formId: string): Promise<RegistrationForm> {
    return later(() => {
      const form = this.ownForm(actor.orgId, formId);
      const version = (form.versions.at(-1)?.version ?? 0) + 1;
      form.versions.push({ version, fields: form.draft });

      return this.view(form);
    });
  }

  listSubmissions(userId: string, orgId: string, formId: string): Promise<RegistrationRow[]> {
    return later(() => {
      this.ownForm(orgId, formId);

      return [...this.registrations.values()]
        .filter(r => r.formId === formId && r.orgId === orgId)
        .map(r => ({
          id: r.id,
          formVersion: r.version,
          submittedAt: r.createdAt,
          status: r.status,
          confirmedAt: r.confirmedAt,
          standard: r.answers.standard,
          custom: r.answers.custom,
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
          })),
        }));
    });
  }

  submit(actor: Actor, registration: NewRegistration, rule: RegistrationRule): Promise<string> {
    return later(() => {
      const form = this.ownForm(actor.orgId, registration.formId);
      const decision = rule({
        publishedVersion: form.versions.at(-1)?.version ?? null,
        formSessionIds: form.sessionIds,
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
        places,
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
}

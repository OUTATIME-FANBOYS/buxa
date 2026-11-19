import { randomUUID } from 'node:crypto';
import type { Actor } from '@buxa/domain';
import type { CustomField, RegistrationForm, RegistrationFormInput, RegistrationRow } from '@buxa/contracts';
import { RegistrationFormNotFoundError, RegistrationRefusedError, RegistrationSessionNotFoundError } from './errors';
import type {
  NewRegistration,
  PublishedVersion,
  RegistrationRepository,
  RegistrationRule,
} from './RegistrationRepository';

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

  constructor(private readonly campSessions: Record<string, string[]>) {}

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

  listForms(orgId: string): Promise<RegistrationForm[]> {
    return later(() => [...this.forms.values()].filter(f => f.orgId === orgId).map(f => this.view(f)));
  }

  getForm(orgId: string, formId: string): Promise<RegistrationForm | null> {
    return later(() => {
      const form = this.forms.get(formId);

      return form && form.orgId === orgId ? this.view(form) : null;
    });
  }

  getPublishedVersion(orgId: string, formId: string): Promise<PublishedVersion | null> {
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

  listSubmissions(orgId: string, formId: string): Promise<RegistrationRow[]> {
    return later(() => {
      this.ownForm(orgId, formId);

      return [...this.registrations.values()]
        .filter(r => r.formId === formId && r.orgId === orgId)
        .map(r => ({
          id: r.id,
          formVersion: r.version,
          submittedAt: r.createdAt,
          standard: r.answers.standard,
          custom: r.answers.custom,
          sessions: r.sessionIds.map(sessionId => ({
            sessionId,
            sessionName: sessionId,
            status: 'submitted' as const,
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
      this.registrations.set(id, {
        id,
        orgId: actor.orgId,
        formId: form.id,
        version: registration.version,
        sessionIds: registration.sessionIds,
        answers: registration.answers,
        createdAt: new Date().toISOString(),
      });

      return id;
    });
  }
}

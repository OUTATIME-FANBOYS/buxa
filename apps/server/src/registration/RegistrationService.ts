import { can, decideConfirmation, decideRegistration, isUuid, type Actor } from '@buxa/domain';
import {
  buildSubmissionSchema,
  RegistrationFormInputSchema,
  type RegistrationForm,
  type RegistrationFormInput,
  type RegistrationRow,
} from '@buxa/contracts';
import { assertAllowed } from '../auth/authorize';
import type { CredentialService } from '../services/credentials/CredentialService';
import type { CredentialRepository } from '../credentials/CredentialRepository';
import {
  RegistrationFormNotFoundError,
  RegistrationInvalidError,
  RegistrationNotFoundError,
  RegistrationRefusedError,
} from './errors';
import type { PublishedVersion, RegistrationRepository } from './RegistrationRepository';

/**
 * What a screen or an API route may ask of registration forms. Each method checks its permission first (a denial throws a 403),
 * validates the input with the contract, and then calls the repository. Refusals and missing forms are thrown as the errors in
 * ./errors.ts; the composers turn them into messages.
 *
 * Holds and the waitlist are not here. When they arrive, `submit` gains a step that takes a place per session and records its status.
 */
/**
 * What a confirmation reports back. `badgesIssued` counts the campers who got a badge in the same transaction. `badgeNote` is set
 * when badges are still needed but this actor may not issue them (only credentials:manage may).
 */
export interface ConfirmOutcome {
  badgesIssued: number;
  badgeNote: string | null;
}

export interface RegistrationService {
  listForms(actor: Actor): Promise<RegistrationForm[]>;
  getForm(actor: Actor, formId: string): Promise<RegistrationForm>;
  createForm(actor: Actor, input: unknown): Promise<RegistrationForm>;
  updateForm(actor: Actor, formId: string, input: unknown): Promise<RegistrationForm>;
  publishForm(actor: Actor, formId: string): Promise<RegistrationForm>;
  listSubmissions(actor: Actor, formId: string): Promise<RegistrationRow[]>;
  /** The definitions a family answers: the published version, or null when the form is not published. Needs registration:submit. */
  publishedVersion(actor: Actor, formId: string): Promise<PublishedVersion | null>;
  /** Records a registration. `input` is untrusted: it is checked against the form's published version. Returns the new id. */
  submit(actor: Actor, formId: string, input: unknown): Promise<string>;
  /**
   * Confirms a pending registration. Audited as `registration.confirm`. Refuses a registration that is already confirmed. Needs
   * registration:confirm. Each camper in the registration who has no active badge gets one issued in the same transaction, when the
   * actor may manage credentials; otherwise the badges are left for an admin and the outcome says so.
   */
  confirm(actor: Actor, registrationId: string): Promise<ConfirmOutcome>;
}

/** Zod's issues, keyed by the field name the form uses. The first message for a field wins. */
function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const name = issue.path.map(String).join('.') || 'form';
    errors[name] ??= issue.message;
  }

  return errors;
}

/** Drops the answers that were left blank, so only given answers are stored. */
function present<T>(values: Record<string, T | undefined>): Record<string, T> {
  return Object.fromEntries(Object.entries(values).filter((e): e is [string, T] => e[1] !== undefined));
}

async function requireForm(
  repo: RegistrationRepository,
  actor: Pick<Actor, 'userId' | 'orgId'>,
  formId: string,
): Promise<RegistrationForm> {
  const form = await repo.getForm(actor.userId, actor.orgId, formId);
  if (!form) {
    throw new RegistrationFormNotFoundError();
  }

  return form;
}

/** Builds the credentials service over a given badge repository (the confirmation's transaction, in production). */
export type CredentialsFor = (credentials: CredentialRepository) => CredentialService;

export function createRegistrationService(
  repo: RegistrationRepository,
  credentialsFor: CredentialsFor,
): RegistrationService {
  return {
    async listForms(actor) {
      assertAllowed(actor, 'registration:read');

      return repo.listForms(actor.userId, actor.orgId);
    },

    async getForm(actor, formId) {
      assertAllowed(actor, 'registration:read');

      return requireForm(repo, actor, formId);
    },

    async createForm(actor, input) {
      assertAllowed(actor, 'registration:manage');
      const parsed = parseFormInput(input);

      return repo.createForm(actor, parsed);
    },

    async updateForm(actor, formId, input) {
      assertAllowed(actor, 'registration:manage');
      const parsed = parseFormInput(input);

      return repo.updateForm(actor, formId, parsed);
    },

    async publishForm(actor, formId) {
      assertAllowed(actor, 'registration:manage');

      return repo.publishForm(actor, formId);
    },

    async listSubmissions(actor, formId) {
      assertAllowed(actor, 'registration:read');

      return repo.listSubmissions(actor.userId, actor.orgId, formId);
    },

    async publishedVersion(actor, formId) {
      assertAllowed(actor, 'registration:submit');
      await requireForm(repo, actor, formId);

      return repo.getPublishedVersion(actor.userId, actor.orgId, formId);
    },

    async submit(actor, formId, input) {
      assertAllowed(actor, 'registration:submit');
      await requireForm(repo, actor, formId);

      const published = await repo.getPublishedVersion(actor.userId, actor.orgId, formId);
      if (!published) {
        throw new RegistrationRefusedError('form_not_published');
      }
      const parsed = buildSubmissionSchema(published.fields).safeParse({
        ...(typeof input === 'object' && input !== null ? input : {}),
        formId,
      });
      if (!parsed.success) {
        throw new RegistrationInvalidError(fieldErrorsOf(parsed.error.issues));
      }
      const { sessionIds, standard, custom } = parsed.data;

      return repo.submit(
        actor,
        {
          formId,
          version: published.version,
          sessionIds,
          answers: { standard: present(standard), custom: present(custom) },
        },
        facts => decideRegistration({ ...facts, requestedSessionIds: sessionIds }),
      );
    },

    async confirm(actor, registrationId) {
      assertAllowed(actor, 'registration:confirm');
      if (!isUuid(registrationId)) {
        throw new RegistrationNotFoundError();
      }

      return repo.confirm(actor, registrationId, decideConfirmation, async unit => {
        const campers = await unit.campers();
        const holders = await unit.credentials.withActive(actor.userId, actor.orgId, campers);
        const missing = campers.filter(id => !holders.has(id));
        if (missing.length === 0) {
          return { badgesIssued: 0, badgeNote: null };
        }
        if (!can(actor, 'credentials:manage')) {
          return {
            badgesIssued: 0,
            badgeNote: `Badges for ${missing.length} camper${missing.length === 1 ? '' : 's'} need issuing by an admin.`,
          };
        }
        const credentials = credentialsFor(unit.credentials);
        for (const personId of missing) {
          await credentials.issue(actor, personId);
        }

        return { badgesIssued: missing.length, badgeNote: null };
      });
    },
  };
}

/** A form as the camp sends it. A bad form is reported with the field names the form uses. */
function parseFormInput(input: unknown): RegistrationFormInput {
  const parsed = RegistrationFormInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new RegistrationInvalidError(fieldErrorsOf(parsed.error.issues));
  }

  return parsed.data;
}

import {
  can,
  decideConfirmation,
  decideErasure,
  decideRegistration,
  decideSelections,
  decideWithdrawal,
  isUuid,
  type Actor,
  type ClassSelection,
  type SelectionDecision,
} from '@buxa/domain';
import {
  buildSubmissionSchema,
  RecordPaymentInputSchema,
  RegistrationFormInputSchema,
  type RegistrationForm,
  type RegistrationFormInput,
  type RegistrationRow,
} from '@buxa/contracts';
import { assertAllowed } from '../auth/authorize';
import type { CredentialService } from '../services/credentials/CredentialService';
import type { CredentialRepository } from '../credentials/CredentialRepository';
import {
  RegistrationClassNotFoundError,
  RegistrationFormNotFoundError,
  RegistrationInvalidError,
  RegistrationNotFoundError,
  RegistrationRefusedError,
} from './errors';
import type { ClassLookup, PublishedVersion, RegistrationRepository } from './RegistrationRepository';

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
   * Records how one child's place in a class was paid. Staff with registration:confirm. `paid` needs a note saying how; the note
   * is stored, and the audit entry records only that there is one.
   */
  recordPayment(actor: Actor, registrationClassId: string, input: unknown): Promise<void>;
  /**
   * Confirms a pending registration. Audited as `registration.confirm`. Refuses a registration that is already confirmed. Needs
   * registration:confirm. Each camper in the registration who has no active badge gets one issued in the same transaction, when the
   * actor may manage credentials; otherwise the badges are left for an admin and the outcome says so.
   */
  confirm(actor: Actor, registrationId: string): Promise<ConfirmOutcome>;
  /**
   * Withdraws a registration: its seat holds are released, its enrolments cancelled (the waitlist moves up) and the record is
   * kept, marked withdrawn. Audited as `registration.withdraw`. A registration already withdrawn is refused. Needs registration:confirm.
   */
  withdraw(actor: Actor, registrationId: string): Promise<void>;
  /** Hides a registration from lists; it is kept. Audited. Needs registration:confirm. */
  archive(actor: Actor, registrationId: string): Promise<void>;
  /** Brings an archived registration back into lists. Audited. Needs registration:confirm. */
  unarchive(actor: Actor, registrationId: string): Promise<void>;
  /**
   * Erases a registration and all its answers. Needs registration:delete (admin and owner). A confirmed registration that still has
   * enrolments is refused: withdraw it first. Audited as `registration.delete`, without personal data.
   */
  erase(actor: Actor, registrationId: string): Promise<void>;
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

/** A registration id that is not a uuid is a registration that does not exist. */
function requireRegistrationId(registrationId: string): string {
  if (!isUuid(registrationId)) {
    throw new RegistrationNotFoundError();
  }

  return registrationId;
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
      const { selections: chosen, standard, custom } = parsed.data;
      const selections = await resolveSelections(repo, actor, chosen);
      // The session is taken from each class: the family never picks one.
      const sessionIds = [...new Set(selections.map(s => s.sessionId))];

      return repo.submit(
        actor,
        {
          formId,
          version: published.version,
          sessionIds,
          selections,
          answers: { standard: present(standard), custom: present(custom) },
        },
        facts => decideRegistration({ ...facts, requestedSessionIds: sessionIds }),
      );
    },

    async recordPayment(actor, registrationClassId, input) {
      assertAllowed(actor, 'registration:confirm');
      if (!isUuid(registrationClassId)) {
        throw new RegistrationClassNotFoundError();
      }
      const parsed = RecordPaymentInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new RegistrationInvalidError(fieldErrorsOf(parsed.error.issues));
      }

      return repo.recordPayment(actor, registrationClassId, parsed.data);
    },

    async withdraw(actor, registrationId) {
      assertAllowed(actor, 'registration:confirm');
      await repo.withdraw(actor, requireRegistrationId(registrationId), decideWithdrawal);
    },

    async archive(actor, registrationId) {
      assertAllowed(actor, 'registration:confirm');
      await repo.setArchived(actor, requireRegistrationId(registrationId), true);
    },

    async unarchive(actor, registrationId) {
      assertAllowed(actor, 'registration:confirm');
      await repo.setArchived(actor, requireRegistrationId(registrationId), false);
    },

    async erase(actor, registrationId) {
      assertAllowed(actor, 'registration:delete');
      await repo.erase(actor, requireRegistrationId(registrationId), decideErasure);
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

/** The clash message names the two classes, so staff can see which one to drop. */
function refuseSelections(decision: Exclude<SelectionDecision, { allow: true }>, names: Map<string, string>): never {
  if (decision.reason === 'classes_overlap') {
    const first = names.get(decision.first.classId) ?? decision.first.className;
    const second = names.get(decision.second.classId) ?? decision.second.className;
    throw new RegistrationRefusedError(
      'classes_overlap',
      `${first} and ${second} overlap for this child. Choose one of them.`,
    );
  }
  throw new RegistrationRefusedError(decision.reason);
}

/**
 * Looks up each chosen class in the camp and checks that the child-and-class pairs fit together: no class twice for one child, and
 * no two classes of one child at overlapping times. Each class must be in the camp; a form's own session set is checked by the rule.
 */
async function resolveSelections(
  repo: RegistrationRepository,
  actor: Actor,
  chosen: { camperId: string; classId: string }[],
): Promise<(ClassSelection & { camperId: string; sessionId: string })[]> {
  const lookups = await repo.classesFor(
    actor.userId,
    actor.orgId,
    chosen.map(c => c.classId),
  );
  const byClass = new Map<string, ClassLookup>(lookups.map(l => [l.classId, l]));
  const selections: (ClassSelection & { camperId: string; sessionId: string })[] = chosen.map(c => {
    const lookup = byClass.get(c.classId);
    if (!lookup) {
      throw new RegistrationClassNotFoundError();
    }

    return {
      camperId: c.camperId,
      classId: c.classId,
      className: lookup.className,
      startsAt: lookup.startsAt,
      endsAt: lookup.endsAt,
      sessionId: lookup.sessionId,
    };
  });
  const decision = decideSelections(selections);
  if (!decision.allow) {
    refuseSelections(decision, new Map(lookups.map(l => [l.classId, l.className])));
  }

  return selections;
}

/** A form as the camp sends it. A bad form is reported with the field names the form uses. */
function parseFormInput(input: unknown): RegistrationFormInput {
  const parsed = RegistrationFormInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new RegistrationInvalidError(fieldErrorsOf(parsed.error.issues));
  }

  return parsed.data;
}

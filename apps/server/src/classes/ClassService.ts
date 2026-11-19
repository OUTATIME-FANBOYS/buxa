import type { Actor } from '@buxa/domain';
import type {
  CancelEnrolmentInput,
  Class,
  Enrolment,
  EnrolInput,
  NewClassInput,
  NewSessionInput,
  Session,
} from '@buxa/contracts';
import { assertAllowed } from '../auth/authorize';
import type { ClassRepository } from './ClassRepository';
import { ClassNotFoundError } from './errors';
import { createEnrolmentMethods } from './EnrolmentService';
import { attempt, ok, type Outcome } from './outcome';

export type { Outcome, Failure, FailureReason } from './outcome';

/**
 * What a screen or an API route may ask of classes, sessions and enrolments. Each method checks its permission first (a denial
 * throws a 403) and returns an Outcome for the expected cases. Unexpected errors throw.
 */
export interface ClassService {
  listClasses(actor: Actor): Promise<Outcome<Class[]>>;
  getClass(actor: Actor, classId: string): Promise<Outcome<Class>>;
  createClass(actor: Actor, input: NewClassInput): Promise<Outcome<Class>>;
  addSession(actor: Actor, classId: string, input: NewSessionInput): Promise<Outcome<Session>>;
  listSessions(actor: Actor, classId: string): Promise<Outcome<Session[]>>;
  listEnrolments(actor: Actor, sessionId: string): Promise<Outcome<Enrolment[]>>;
  enrol(actor: Actor, input: EnrolInput): Promise<Outcome<Enrolment>>;
  cancelEnrolment(actor: Actor, input: CancelEnrolmentInput): Promise<Outcome<Enrolment>>;
}

export interface ClassServiceDeps {
  repo: ClassRepository;
  /** The camp's IANA zone (orgs.timezone). Used for the camp's local day and for wording refusals. */
  timezoneOf: (orgId: string) => Promise<string>;
}

export function createClassService({ repo, timezoneOf }: ClassServiceDeps): ClassService {
  return {
    async listClasses(actor) {
      assertAllowed(actor, 'events:read');

      return ok(await repo.listClasses(actor.orgId));
    },

    async getClass(actor, classId) {
      assertAllowed(actor, 'events:read');

      return attempt(
        async () => {
          const found = await repo.getClass(actor.orgId, classId);
          if (!found) {
            throw new ClassNotFoundError();
          }

          return found;
        },
        await timezoneOf(actor.orgId),
      );
    },

    async createClass(actor, input) {
      assertAllowed(actor, 'classes:manage');

      return attempt(() => repo.createClass(actor, input), await timezoneOf(actor.orgId));
    },

    async addSession(actor, classId, input) {
      assertAllowed(actor, 'classes:manage');

      return attempt(
        async () => {
          const cls = await repo.getClass(actor.orgId, classId);
          if (!cls) {
            throw new ClassNotFoundError();
          }

          return repo.addSession(actor, classId, {
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            location: input.location,
            instructorIds: input.instructorIds,
            capacity: input.capacity ?? cls.capacity,
          });
        },
        await timezoneOf(actor.orgId),
      );
    },

    async listSessions(actor, classId) {
      assertAllowed(actor, 'events:read');

      return attempt(() => repo.listSessions(actor.orgId, classId), await timezoneOf(actor.orgId));
    },

    async listEnrolments(actor, sessionId) {
      // Viewers see who is enrolled, by name. Contact details are not part of an enrolment at all.
      assertAllowed(actor, 'people:read');

      return attempt(() => repo.listEnrolments(actor.orgId, sessionId), await timezoneOf(actor.orgId));
    },

    ...createEnrolmentMethods({ repo, timezoneOf }),
  };
}

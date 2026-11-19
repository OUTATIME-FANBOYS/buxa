import { classWithinSession, type Actor } from '@buxa/domain';
import type {
  CancelEnrolmentInput,
  Class,
  ClassInput,
  Enrolment,
  EnrolInput,
  NewSessionInput,
  Session,
  SessionPriceInput,
} from '@buxa/contracts';
import { assertAllowed } from '../auth/authorize';
import type { ClassRecord, ClassRepository } from './ClassRepository';
import { ClassNotFoundError, ClassOutsideSessionError, SessionNotFoundError } from './errors';
import { createEnrolmentMethods } from './EnrolmentService';
import { attempt, ok, type Outcome } from './outcome';

export type { Outcome, Failure, FailureReason } from './outcome';

/**
 * What a screen or an API route may ask of sessions, classes and enrolments. Each method checks its permission first (a denial
 * throws a 403) and returns an Outcome for the expected cases. Unexpected errors throw.
 */
export interface ClassService {
  listSessions(actor: Actor): Promise<Outcome<Session[]>>;
  getSession(actor: Actor, sessionId: string): Promise<Outcome<Session>>;
  createSession(actor: Actor, input: NewSessionInput): Promise<Outcome<Session>>;
  /** Sets or clears a session's price. Needs classes:manage (staff and above); a viewer is refused. */
  setSessionPrice(actor: Actor, sessionId: string, price: SessionPriceInput | null): Promise<Outcome<Session>>;
  listClasses(actor: Actor, sessionId: string): Promise<Outcome<Class[]>>;
  getClass(actor: Actor, classId: string): Promise<Outcome<Class>>;
  addClass(actor: Actor, sessionId: string, input: ClassInput): Promise<Outcome<Class>>;
  updateClass(actor: Actor, classId: string, input: ClassInput): Promise<Outcome<Class>>;
  deleteClass(actor: Actor, classId: string): Promise<Outcome<null>>;
  listEnrolments(actor: Actor, classId: string): Promise<Outcome<Enrolment[]>>;
  enrol(actor: Actor, input: EnrolInput): Promise<Outcome<Enrolment>>;
  cancelEnrolment(actor: Actor, input: CancelEnrolmentInput): Promise<Outcome<Enrolment>>;
}

export interface ClassServiceDeps {
  repo: ClassRepository;
  /** The camp's IANA zone (orgs.timezone). Used for the camp's local day and for wording refusals. */
  timezoneOf: (orgId: string) => Promise<string>;
}

/**
 * A class's time range must fall on days inside its session's dates. A session with no dates yet (written before the date range
 * existed) takes the class's days: the database widens its range when the class is written.
 */
async function requireWithinSession(
  repo: ClassRepository,
  orgId: string,
  sessionId: string,
  times: { startsAt: string; endsAt: string },
  timeZone: string,
): Promise<void> {
  const session = await repo.getSession(orgId, sessionId);
  if (!session) {
    throw new SessionNotFoundError();
  }
  if (session.startsOn === null || session.endsOn === null) {
    return;
  }
  const days = { startsOn: session.startsOn, endsOn: session.endsOn };
  if (!classWithinSession(times, days, timeZone)) {
    throw new ClassOutsideSessionError(days.startsOn, days.endsOn);
  }
}

function toRecord(input: ClassInput): ClassRecord {
  return {
    name: input.name,
    ageRange: input.ageRange,
    capacity: input.capacity,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    location: input.location,
    instructorIds: input.instructorIds,
  };
}

export function createClassService({ repo, timezoneOf }: ClassServiceDeps): ClassService {
  return {
    async listSessions(actor) {
      assertAllowed(actor, 'events:read');

      return ok(await repo.listSessions(actor.orgId));
    },

    async getSession(actor, sessionId) {
      assertAllowed(actor, 'events:read');

      return attempt(
        async () => {
          const found = await repo.getSession(actor.orgId, sessionId);
          if (!found) {
            throw new SessionNotFoundError();
          }

          return found;
        },
        await timezoneOf(actor.orgId),
      );
    },

    async createSession(actor, input) {
      assertAllowed(actor, 'classes:manage');

      return attempt(() => repo.createSession(actor, input), await timezoneOf(actor.orgId));
    },

    async setSessionPrice(actor, sessionId, price) {
      assertAllowed(actor, 'classes:manage');

      return attempt(() => repo.setSessionPrice(actor, sessionId, price), await timezoneOf(actor.orgId));
    },

    async listClasses(actor, sessionId) {
      assertAllowed(actor, 'events:read');

      return attempt(() => repo.listClasses(actor.orgId, sessionId), await timezoneOf(actor.orgId));
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

    async addClass(actor, sessionId, input) {
      assertAllowed(actor, 'classes:manage');
      const timeZone = await timezoneOf(actor.orgId);

      return attempt(async () => {
        await requireWithinSession(repo, actor.orgId, sessionId, input, timeZone);

        return repo.addClass(actor, sessionId, toRecord(input));
      }, timeZone);
    },

    async updateClass(actor, classId, input) {
      assertAllowed(actor, 'classes:manage');
      const timeZone = await timezoneOf(actor.orgId);

      return attempt(async () => {
        const existing = await repo.getClass(actor.orgId, classId);
        if (!existing) {
          throw new ClassNotFoundError();
        }
        await requireWithinSession(repo, actor.orgId, existing.sessionId, input, timeZone);

        return repo.updateClass(actor, classId, toRecord(input));
      }, timeZone);
    },

    async deleteClass(actor, classId) {
      assertAllowed(actor, 'classes:manage');

      return attempt(
        async () => {
          await repo.deleteClass(actor, classId);

          return null;
        },
        await timezoneOf(actor.orgId),
      );
    },

    async listEnrolments(actor, classId) {
      // Viewers see who is enrolled, by name. Contact details are not part of an enrolment at all.
      assertAllowed(actor, 'people:read');

      return attempt(() => repo.listEnrolments(actor.orgId, classId), await timezoneOf(actor.orgId));
    },

    ...createEnrolmentMethods({ repo, timezoneOf }),
  };
}

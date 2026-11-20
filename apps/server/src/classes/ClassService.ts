import {
  can,
  classFieldsOutsideDetails,
  classWithinSession,
  expandClassRule,
  findClash,
  formatClash,
  type Actor,
} from '@buxa/domain';
import type {
  CancelEnrolmentInput,
  Class,
  ClassInput,
  Enrolment,
  EnrolInput,
  NewRecurringClassInput,
  NewSessionInput,
  Session,
  SessionPriceInput,
} from '@buxa/contracts';
import { assertAllowed } from '../auth/authorize';
import type { ClassRecord, ClassRepository, CampClassSpan } from './ClassRepository';
import { teacherScopeOf, type TeacherScope } from './teacherScope';
import {
  ClassNotFoundError,
  ClassOutsideSessionError,
  RecurrenceRefusedError,
  SessionNotFoundError,
  TeacherFieldRefusedError,
} from './errors';
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
  /** Shows or hides a session's public page. */
  setSessionPublic(actor: Actor, sessionId: string, isPublic: boolean): Promise<Outcome<Session>>;
  /**
   * A weekly series of classes under a session. Each class is checked against the session's dates and against every class in
   * the camp (and the earlier classes of the series), then all are written, or none.
   */
  addRecurringClasses(actor: Actor, sessionId: string, input: NewRecurringClassInput): Promise<Outcome<Class[]>>;
  listClasses(actor: Actor, sessionId: string): Promise<Outcome<Class[]>>;
  getClass(actor: Actor, classId: string): Promise<Outcome<Class>>;
  addClass(actor: Actor, sessionId: string, input: ClassInput): Promise<Outcome<Class>>;
  /**
   * Saves a class. Staff and above (classes:manage) may change every field. A teacher (events:update_details, its own classes
   * only) may change the name and description; a change to any other field is refused with teacher_field_refused.
   */
  updateClass(actor: Actor, classId: string, input: ClassInput): Promise<Outcome<Class>>;
  deleteClass(actor: Actor, classId: string): Promise<Outcome<null>>;
  /** Replaces the class's teachers. Staff and admins (classes:manage). Each user must hold the teacher role in this camp. */
  setTeachers(actor: Actor, classId: string, userIds: readonly string[]): Promise<Outcome<null>>;
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

/** The sessions that hold at least one of the teacher's classes. */
async function sessionIdsOf(repo: ClassRepository, orgId: string, scope: TeacherScope): Promise<Set<string>> {
  const found = await Promise.all([...scope.classIds].map(id => repo.getClass(orgId, id)));

  return new Set(found.flatMap(c => (c ? [c.sessionId] : [])));
}

export function createClassService({ repo, timezoneOf }: ClassServiceDeps): ClassService {
  return {
    async listSessions(actor) {
      // A teacher sees only the sessions that hold one of its classes.
      const scope = await teacherScopeOf(repo, actor);
      assertAllowed(actor, 'events:read', { assignedToClass: scope === null ? undefined : true });
      const sessions = await repo.listSessions(actor.orgId);
      if (scope === null) {
        return ok(sessions);
      }
      const mine = await sessionIdsOf(repo, actor.orgId, scope);

      return ok(sessions.filter(s => mine.has(s.id)));
    },

    async getSession(actor, sessionId) {
      const scope = await teacherScopeOf(repo, actor);
      const assignedToClass =
        scope === null ? undefined : (await sessionIdsOf(repo, actor.orgId, scope)).has(sessionId);
      assertAllowed(actor, 'events:read', { assignedToClass });

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

    async setSessionPublic(actor, sessionId, isPublic) {
      assertAllowed(actor, 'classes:manage');

      return attempt(() => repo.setSessionPublic(actor, sessionId, isPublic), await timezoneOf(actor.orgId));
    },

    async addRecurringClasses(actor, sessionId, input) {
      assertAllowed(actor, 'classes:manage');
      const timeZone = await timezoneOf(actor.orgId);

      return attempt(async () => {
        const session = await repo.getSession(actor.orgId, sessionId);
        if (!session) {
          throw new SessionNotFoundError();
        }
        const expanded = expandClassRule(input.rule, timeZone);
        if (!expanded.ok) {
          throw new RecurrenceRefusedError('recurrence_invalid', expanded.message);
        }

        const days =
          session.startsOn !== null && session.endsOn !== null
            ? { startsOn: session.startsOn, endsOn: session.endsOn }
            : null;
        // Each class is checked against every class in the camp and against the earlier classes of this series, as an import is.
        const existing: CampClassSpan[] = await repo.listCampClassSpans(actor.orgId);
        const accepted: CampClassSpan[] = [];
        for (const occurrence of expanded.occurrences) {
          if (days && !classWithinSession(occurrence, days, timeZone)) {
            throw new ClassOutsideSessionError(days.startsOn, days.endsOn);
          }
          const clash = findClash(occurrence, [...existing, ...accepted]);
          if (clash) {
            throw new RecurrenceRefusedError(
              'class_clash',
              `The class on ${occurrence.date} clashes with ${clash.className} (${formatClash(clash, timeZone)}). Choose other times or change the rule; nothing was saved.`,
            );
          }
          accepted.push({ startsAt: occurrence.startsAt, endsAt: occurrence.endsAt, className: input.name });
        }

        const records: ClassRecord[] = expanded.occurrences.map(o => ({
          name: input.name,
          ageRange: input.ageRange,
          capacity: input.capacity,
          startsAt: o.startsAt,
          endsAt: o.endsAt,
          location: input.location,
          instructorIds: input.instructorIds,
        }));

        return repo.addClasses(actor, sessionId, records);
      }, timeZone);
    },

    async setSessionPrice(actor, sessionId, price) {
      assertAllowed(actor, 'classes:manage');

      return attempt(() => repo.setSessionPrice(actor, sessionId, price), await timezoneOf(actor.orgId));
    },

    async listClasses(actor, sessionId) {
      const scope = await teacherScopeOf(repo, actor);
      assertAllowed(actor, 'events:read', { assignedToClass: scope === null ? undefined : true });

      return attempt(
        async () => {
          const all = await repo.listClasses(actor.orgId, sessionId);

          return scope === null ? all : all.filter(c => scope.classIds.has(c.id));
        },
        await timezoneOf(actor.orgId),
      );
    },

    async getClass(actor, classId) {
      const scope = await teacherScopeOf(repo, actor);
      assertAllowed(actor, 'events:read', {
        assignedToClass: scope === null ? undefined : scope.classIds.has(classId),
      });

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
      const scope = await teacherScopeOf(repo, actor);
      const detailsOnly = !can(actor, 'classes:manage');
      if (detailsOnly) {
        assertAllowed(actor, 'events:update_details', {
          assignedToClass: scope === null ? undefined : scope.classIds.has(classId),
        });
      } else {
        assertAllowed(actor, 'classes:manage');
      }
      const timeZone = await timezoneOf(actor.orgId);

      return attempt(async () => {
        const existing = await repo.getClass(actor.orgId, classId);
        if (!existing) {
          throw new ClassNotFoundError();
        }
        if (detailsOnly) {
          const locked = classFieldsOutsideDetails(existing, input);
          if (locked.length > 0) {
            throw new TeacherFieldRefusedError(locked);
          }
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

    async setTeachers(actor, classId, userIds) {
      assertAllowed(actor, 'classes:manage');

      return attempt(
        async () => {
          await repo.replaceTeachers(actor, classId, userIds);

          return null;
        },
        await timezoneOf(actor.orgId),
      );
    },

    async listEnrolments(actor, classId) {
      // Viewers see who is enrolled, by name. Contact details are not part of an enrolment at all.
      const scope = await teacherScopeOf(repo, actor);
      assertAllowed(actor, 'people:read', {
        assignedToClass: scope === null ? undefined : scope.classIds.has(classId),
      });

      return attempt(() => repo.listEnrolments(actor.orgId, classId), await timezoneOf(actor.orgId));
    },

    ...createEnrolmentMethods({ repo, timezoneOf }),
  };
}

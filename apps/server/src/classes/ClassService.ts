import {
  can,
  classFieldsOutsideDetails,
  classWithinSession,
  expandClassRule,
  findClash,
  formatClash,
  type Actor,
} from '@buxa/domain';
import {
  NewSessionInputSchema,
  type CancelEnrolmentInput,
  type Class,
  type ClassInput,
  type Enrolment,
  type EnrolInput,
  type NewRecurringClassInput,
  type NewSessionInput,
  type Session,
  type SessionDeleteImpact,
  type SessionEditInput,
} from '@buxa/contracts';
import { assertAllowed } from '../auth/authorize';
import type { CampClassSpan, CampWaitlistEntry, ClassRecord, ClassRepository } from './ClassRepository';
import { teacherScopeOf, type TeacherScope } from './teacherScope';
import {
  ClassNotFoundError,
  ClassOutsideSessionError,
  RecurrenceRefusedError,
  SessionNameConfirmationError,
  SessionNameTakenError,
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
/** One of a teacher's classes, with only what the teacher needs to plan the day: no seats, no campers, no instructors. */
export type AssignedClass = Pick<Class, 'id' | 'name' | 'ageRange' | 'startsAt' | 'endsAt' | 'location'>;

/** A session that holds at least one of the teacher's classes, and those classes in start order. */
export interface AssignedSession {
  id: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  classes: AssignedClass[];
}

export interface ClassService {
  listSessions(actor: Actor): Promise<Outcome<Session[]>>;
  /**
   * The signed-in teacher's own classes, grouped by session. Only the actor's assigned classes are read (teacherScope), so no other
   * teacher's class and no camper appears. A person who is not a teacher gets an empty list.
   */
  listMyClasses(actor: Actor): Promise<Outcome<AssignedSession[]>>;
  getSession(actor: Actor, sessionId: string): Promise<Outcome<Session>>;
  createSession(actor: Actor, input: NewSessionInput): Promise<Outcome<Session>>;
  /**
   * Saves a session's name, description, first and last day and public flag. Needs classes:manage. The session schema checks the
   * dates (the last day on or after the first), and every class must still fall inside the new dates.
   */
  updateSession(actor: Actor, sessionId: string, input: SessionEditInput): Promise<Outcome<Session>>;
  /** Deletes a session that holds no classes. Needs classes:manage. A session with any class is refused. */
  deleteSession(actor: Actor, sessionId: string): Promise<Outcome<null>>;
  /**
   * Takes a draft session live, so registration and enrolment are accepted. Needs classes:publish (admin and owner). A live session
   * is returned unchanged; an archived one is refused (session_not_draft): unarchive it instead. Audited as `session.publish`.
   */
  publishSession(actor: Actor, sessionId: string): Promise<Outcome<Session>>;
  /**
   * What deleting a draft session would remove (its classes, groups, rooms, assignments, instructors and form links), for the
   * confirmation that lists them. Needs classes:delete_with_classes.
   */
  sessionDeleteImpact(actor: Actor, sessionId: string): Promise<Outcome<SessionDeleteImpact>>;
  /**
   * Deletes a session with its classes. Needs classes:delete_with_classes (admin and owner). `confirmName` must be the session's
   * name exactly (case and spaces as written). A draft is deleted with everything under it. A live or archived session whose
   * classes have enrolments, holds, registrations, check-ins or season passes is refused with a message to unenrol first, and
   * nothing is deleted.
   */
  deleteSessionWithClasses(actor: Actor, sessionId: string, confirmName: string): Promise<Outcome<null>>;
  /**
   * Archives a session (hidden from registration and its public page; its classes and history are kept). Needs classes:manage.
   * Unarchiving needs org:update (admin and owner).
   */
  setSessionArchived(actor: Actor, sessionId: string, archived: boolean): Promise<Outcome<Session>>;
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
  listEnrolments(actor: Actor, classId: string): Promise<Outcome<Enrolment[]>>;
  /**
   * Every waitlisted camper in the camp, by class and then in the order they joined, for the camp-wide holds screen. Needs
   * registration:read (the same people who can read registration). Read only.
   */
  listCampWaitlists(actor: Actor): Promise<CampWaitlistEntry[]>;
  enrol(actor: Actor, input: EnrolInput): Promise<Outcome<Enrolment>>;
  cancelEnrolment(actor: Actor, input: CancelEnrolmentInput): Promise<Outcome<Enrolment>>;
}

export interface ClassServiceDeps {
  repo: ClassRepository;
  /** The camp's IANA zone (orgs.timezone). Used for the camp's local day and for wording refusals. */
  timezoneOf: (actor: Pick<Actor, 'userId' | 'orgId'>) => Promise<string>;
}

/**
 * A class's time range must fall on days inside its session's dates. A session with no dates yet (written before the date range
 * existed) takes the class's days: the database widens its range when the class is written.
 */
async function requireWithinSession(
  repo: ClassRepository,
  actor: Actor,
  sessionId: string,
  times: { startsAt: string; endsAt: string },
  timeZone: string,
): Promise<void> {
  const session = await repo.getSession(actor.userId, actor.orgId, sessionId);
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
    price: input.price,
  };
}

/** A session name is unique in the camp, ignoring case and spaces. Throws SessionNameTakenError when another session has it. */
async function requireNameFree(
  repo: ClassRepository,
  actor: Actor,
  name: string,
  exceptId: string | null,
): Promise<void> {
  const existing = await repo.sessionNameTaken(actor.userId, actor.orgId, name, exceptId);
  if (existing !== null) {
    throw new SessionNameTakenError(existing);
  }
}

/** The sessions that hold at least one of the teacher's classes. */
async function sessionIdsOf(repo: ClassRepository, actor: Actor, scope: TeacherScope): Promise<Set<string>> {
  const found = await Promise.all([...scope.classIds].map(id => repo.getClass(actor.userId, actor.orgId, id)));

  return new Set(found.flatMap(c => (c ? [c.sessionId] : [])));
}

export function createClassService({ repo, timezoneOf }: ClassServiceDeps): ClassService {
  return {
    async listSessions(actor) {
      // A teacher sees only the sessions that hold one of its classes.
      const scope = await teacherScopeOf(repo, actor);
      assertAllowed(actor, 'events:read', { assignedToClass: scope === null ? undefined : true });
      const sessions = await repo.listSessions(actor.userId, actor.orgId);
      if (scope === null) {
        return ok(sessions);
      }
      const mine = await sessionIdsOf(repo, actor, scope);

      return ok(sessions.filter(s => mine.has(s.id)));
    },

    async listMyClasses(actor) {
      const scope = await teacherScopeOf(repo, actor);
      if (scope === null) {
        return ok([]);
      }

      return attempt(
        async () => {
          const found = await Promise.all([...scope.classIds].map(id => repo.getClass(actor.userId, actor.orgId, id)));
          const classes = found.flatMap(c => (c ? [c] : []));
          const sessionIds = [...new Set(classes.map(c => c.sessionId))];
          const sessions = await Promise.all(sessionIds.map(id => repo.getSession(actor.userId, actor.orgId, id)));

          const grouped = sessions.flatMap(session => {
            if (!session) {
              return [];
            }
            const mine = classes
              .filter(c => c.sessionId === session.id)
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
              .map(({ id, name, ageRange, startsAt, endsAt, location }) => ({
                id,
                name,
                ageRange,
                startsAt,
                endsAt,
                location,
              }));

            return [
              { id: session.id, name: session.name, startsOn: session.startsOn, endsOn: session.endsOn, classes: mine },
            ];
          });

          // Sessions in date order (undated ones last), so the page reads the same on every database.
          return grouped.sort(
            (a, b) => (a.startsOn ?? '￿').localeCompare(b.startsOn ?? '￿') || a.name.localeCompare(b.name),
          );
        },
        await timezoneOf(actor),
      );
    },

    async getSession(actor, sessionId) {
      const scope = await teacherScopeOf(repo, actor);
      const assignedToClass = scope === null ? undefined : (await sessionIdsOf(repo, actor, scope)).has(sessionId);
      assertAllowed(actor, 'events:read', { assignedToClass });

      return attempt(
        async () => {
          const found = await repo.getSession(actor.userId, actor.orgId, sessionId);
          if (!found) {
            throw new SessionNotFoundError();
          }

          return found;
        },
        await timezoneOf(actor),
      );
    },

    async createSession(actor, input) {
      assertAllowed(actor, 'classes:manage');

      return attempt(
        async () => {
          await requireNameFree(repo, actor, input.name, null);

          return repo.createSession(actor, input);
        },
        await timezoneOf(actor),
      );
    },

    async setSessionArchived(actor, sessionId, archived) {
      if (archived) {
        assertAllowed(actor, 'classes:manage');
      } else {
        assertAllowed(actor, 'org:update');
      }

      return attempt(() => repo.setSessionArchived(actor, sessionId, archived), await timezoneOf(actor));
    },

    async deleteSessionWithClasses(actor, sessionId, confirmName) {
      assertAllowed(actor, 'classes:delete_with_classes');

      return attempt(
        async () => {
          const found = await repo.getSession(actor.userId, actor.orgId, sessionId);
          if (!found) {
            throw new SessionNotFoundError();
          }
          if (confirmName !== found.name) {
            throw new SessionNameConfirmationError();
          }
          if (found.status === 'draft') {
            await repo.deleteDraftSession(actor, sessionId);
          } else {
            await repo.deleteSessionWithClasses(actor, sessionId);
          }

          return null;
        },
        await timezoneOf(actor),
      );
    },

    async publishSession(actor, sessionId) {
      assertAllowed(actor, 'classes:publish');

      return attempt(() => repo.publishSession(actor, sessionId), await timezoneOf(actor));
    },

    async sessionDeleteImpact(actor, sessionId) {
      assertAllowed(actor, 'classes:delete_with_classes');

      return attempt(() => repo.sessionDeleteImpact(actor.userId, actor.orgId, sessionId), await timezoneOf(actor));
    },

    async setSessionPublic(actor, sessionId, isPublic) {
      assertAllowed(actor, 'classes:manage');

      return attempt(() => repo.setSessionPublic(actor, sessionId, isPublic), await timezoneOf(actor));
    },

    async addRecurringClasses(actor, sessionId, input) {
      assertAllowed(actor, 'classes:manage');
      const timeZone = await timezoneOf(actor);

      return attempt(async () => {
        const session = await repo.getSession(actor.userId, actor.orgId, sessionId);
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
        const existing: CampClassSpan[] = await repo.listCampClassSpans(actor.userId, actor.orgId);
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
          price: input.price,
        }));

        return repo.addClasses(actor, sessionId, records);
      }, timeZone);
    },

    async updateSession(actor, sessionId, input) {
      assertAllowed(actor, 'classes:manage');
      const timeZone = await timezoneOf(actor);
      const checked = NewSessionInputSchema.safeParse(input);
      if (!checked.success) {
        return {
          ok: false,
          failure: { reason: 'session_invalid', message: checked.error.issues[0]?.message ?? 'Check the session.' },
        };
      }
      const { startsOn, endsOn } = checked.data;

      return attempt(async () => {
        await requireNameFree(repo, actor, checked.data.name, sessionId);
        for (const cls of await repo.listClasses(actor.userId, actor.orgId, sessionId)) {
          if (!classWithinSession(cls, { startsOn, endsOn }, timeZone)) {
            throw new ClassOutsideSessionError(startsOn, endsOn);
          }
        }

        return repo.updateSession(actor, sessionId, checked.data);
      }, timeZone);
    },

    async deleteSession(actor, sessionId) {
      assertAllowed(actor, 'classes:manage');

      return attempt(
        async () => {
          await repo.deleteSession(actor, sessionId);

          return null;
        },
        await timezoneOf(actor),
      );
    },

    async listClasses(actor, sessionId) {
      const scope = await teacherScopeOf(repo, actor);
      assertAllowed(actor, 'events:read', { assignedToClass: scope === null ? undefined : true });

      return attempt(
        async () => {
          const all = await repo.listClasses(actor.userId, actor.orgId, sessionId);

          return scope === null ? all : all.filter(c => scope.classIds.has(c.id));
        },
        await timezoneOf(actor),
      );
    },

    async getClass(actor, classId) {
      const scope = await teacherScopeOf(repo, actor);
      assertAllowed(actor, 'events:read', {
        assignedToClass: scope === null ? undefined : scope.classIds.has(classId),
      });

      return attempt(
        async () => {
          const found = await repo.getClass(actor.userId, actor.orgId, classId);
          if (!found) {
            throw new ClassNotFoundError();
          }

          return found;
        },
        await timezoneOf(actor),
      );
    },

    async addClass(actor, sessionId, input) {
      assertAllowed(actor, 'classes:manage');
      const timeZone = await timezoneOf(actor);

      return attempt(async () => {
        await requireWithinSession(repo, actor, sessionId, input, timeZone);

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
      const timeZone = await timezoneOf(actor);

      return attempt(async () => {
        const existing = await repo.getClass(actor.userId, actor.orgId, classId);
        if (!existing) {
          throw new ClassNotFoundError();
        }
        if (detailsOnly) {
          const locked = classFieldsOutsideDetails(existing, input);
          if (locked.length > 0) {
            throw new TeacherFieldRefusedError(locked);
          }
        }
        await requireWithinSession(repo, actor, existing.sessionId, input, timeZone);

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
        await timezoneOf(actor),
      );
    },

    async listEnrolments(actor, classId) {
      // Viewers see who is enrolled, by name. Contact details are not part of an enrolment at all.
      const scope = await teacherScopeOf(repo, actor);
      assertAllowed(actor, 'people:read', {
        assignedToClass: scope === null ? undefined : scope.classIds.has(classId),
      });

      return attempt(() => repo.listEnrolments(actor.userId, actor.orgId, classId), await timezoneOf(actor));
    },

    async listCampWaitlists(actor) {
      assertAllowed(actor, 'registration:read');

      return repo.listCampWaitlists(actor.userId, actor.orgId);
    },

    ...createEnrolmentMethods({ repo, timezoneOf }),
  };
}

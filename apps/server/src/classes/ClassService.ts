import {
  can,
  classFieldsOutsideDetails,
  seriesFieldsOutsideDetails,
  classWithinSession,
  teachingDays,
  planSeries,
  planSessionDates,
  type Actor,
  type NamedClass,
} from '@buxa/domain';
import {
  NewSessionInputSchema,
  type CancelEnrolmentInput,
  type Class,
  type ClassInput,
  type Enrolment,
  type EnrolInput,
  type NewSeriesInput,
  type NewSessionInput,
  type Series,
  type SeriesEditInput,
  type Session,
  type SessionDeleteImpact,
  type SessionEditInput,
} from '@buxa/contracts';
import { assertAllowed } from '../auth/authorize';
import type { CampWaitlistEntry, ClassRecord, ClassRepository } from './ClassRepository';
import { activeDays, assertNoLocationClash, dayOf, otherPlaces } from './locationClash';
import { detailsOfInput, detailsOfSeries, fieldsOf, scheduleOfSeries } from './seriesSchedule';
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
import { cancelReasonOf } from '@buxa/domain';

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

/** The classes a session date change would flag, and the ones that would refuse it (see previewSessionDates). */
export interface SessionDatesPreview {
  outside: NamedClass[];
  blocked: NamedClass[];
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
  /**
   * What saving these dates would do, before anything is saved: the classes that would fall outside them (and so be flagged), and
   * the ones that have people on them, which would refuse the save. Needs classes:manage. Read only.
   */
  previewSessionDates(actor: Actor, sessionId: string, input: SessionEditInput): Promise<Outcome<SessionDatesPreview>>;
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
  /** Cancels one day of a series, with a reason. Needs classes:manage. The series is not changed. */
  cancelOccurrence(actor: Actor, occurrenceId: string, reasonText: string): Promise<Outcome<void>>;
  /** Restores a cancelled day. Needs classes:manage. */
  restoreOccurrence(actor: Actor, occurrenceId: string): Promise<Outcome<void>>;
  /**
   * Creates one series under a session, from the New class form: the weekdays ticked between Starts and Ends. Each day is checked
   * against the session's dates and against every class in the camp (and the earlier days of the series), then the series and all its
   * days are written in one transaction, or none. Needs classes:manage.
   */
  addSeries(actor: Actor, sessionId: string, input: NewSeriesInput): Promise<Outcome<Series>>;
  /** The series of a session, one row each. A teacher sees the series it teaches. Read only. */
  listSeries(actor: Actor, sessionId: string): Promise<Outcome<Series[]>>;
  /** One series. A teacher sees only a series it teaches. Read only. */
  getSeries(actor: Actor, seriesId: string): Promise<Outcome<Series>>;
  /** Every day of a series, cancelled ones included, for the series page. Read only. */
  listSeriesOccurrences(actor: Actor, seriesId: string): Promise<Outcome<Class[]>>;
  /** Saves a series' shared fields (name, ages, camp size, location, instructors, price) on every day. Needs classes:manage. */
  updateSeries(actor: Actor, seriesId: string, input: SeriesEditInput): Promise<Outcome<Series>>;
  /** Deletes a series and its days. Needs classes:manage. A series with an enrolment, a hold or a registration is refused. */
  deleteSeries(actor: Actor, seriesId: string): Promise<Outcome<null>>;
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
          // The teaching rule (@buxa/domain): a cancelled day is not a class on a teacher's plan (migration 0064).
          const classes = teachingDays(found.flatMap(c => (c ? [c] : [])));
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

    async cancelOccurrence(actor, occurrenceId, reasonText) {
      assertAllowed(actor, 'classes:manage');
      const reason = cancelReasonOf(reasonText);
      if (!reason.ok) {
        return { ok: false, failure: { reason: 'occurrence_refused', message: reason.message } };
      }

      return attempt(
        () => repo.setOccurrenceStatus(actor, occurrenceId, { kind: 'cancel', reason: reason.reason }),
        await timezoneOf(actor),
      );
    },

    async restoreOccurrence(actor, occurrenceId) {
      assertAllowed(actor, 'classes:manage');
      const timeZone = await timezoneOf(actor);

      return attempt(async () => {
        // A restored day takes its place again, so it must not overlap a class in its location.
        const day = await repo.getClass(actor.userId, actor.orgId, occurrenceId);
        if (day) {
          const others = otherPlaces(await repo.listCampClassSpans(actor.userId, actor.orgId), day.seriesId);
          assertNoLocationClash({ name: day.name, location: day.location }, [dayOf(day, timeZone)], others, timeZone);
        }

        return repo.setOccurrenceStatus(actor, occurrenceId, { kind: 'restore' });
      }, timeZone);
    },
    async addSeries(actor, sessionId, input) {
      assertAllowed(actor, 'classes:manage');
      const timeZone = await timezoneOf(actor);

      return attempt(async () => {
        const session = await repo.getSession(actor.userId, actor.orgId, sessionId);
        if (!session) {
          throw new SessionNotFoundError();
        }
        // The days come from planSeries: each chosen weekday between Starts and Ends, at Starts' and Ends' clock times.
        const plan = planSeries(
          { weekdays: input.weekdays, startsLocal: input.startsAt, endsLocal: input.endsAt },
          timeZone,
        );
        if (!plan.ok) {
          throw new RecurrenceRefusedError('recurrence_invalid', plan.message);
        }

        const days =
          session.startsOn !== null && session.endsOn !== null
            ? { startsOn: session.startsOn, endsOn: session.endsOn }
            : null;
        for (const occurrence of plan.series.occurrences) {
          if (days && !classWithinSession(occurrence, days, timeZone)) {
            throw new ClassOutsideSessionError(days.startsOn, days.endsOn);
          }
        }
        // Each day is checked against the active classes in the same location, and against the earlier days of this series.
        const existing = otherPlaces(await repo.listCampClassSpans(actor.userId, actor.orgId), null);
        assertNoLocationClash(
          { name: input.name, location: input.location },
          plan.series.occurrences.map(o => ({ date: o.date, startsAt: o.startsAt, endsAt: o.endsAt })),
          existing,
          timeZone,
        );

        return repo.addSeries(actor, sessionId, {
          name: input.name,
          ageRange: input.ageRange,
          capacity: input.capacity,
          location: input.location,
          instructorIds: input.instructorIds,
          price: input.price,
          weekdays: plan.series.weekdays,
          seriesStartsAt: plan.series.seriesStartsAt,
          seriesEndsAt: plan.series.seriesEndsAt,
          occurrences: plan.series.occurrences.map(o => ({ startsAt: o.startsAt, endsAt: o.endsAt })),
        });
      }, timeZone);
    },

    async listSeries(actor, sessionId) {
      const scope = await teacherScopeOf(repo, actor);
      assertAllowed(actor, 'events:read', { assignedToClass: scope === null ? undefined : true });

      return attempt(
        async () => {
          const all = await repo.listSeries(actor.userId, actor.orgId, sessionId);
          if (scope === null) {
            return all;
          }
          const visible: Series[] = [];
          for (const series of all) {
            const days = await repo.listSeriesOccurrences(actor.userId, actor.orgId, series.id);
            if (days.some(d => scope.classIds.has(d.id))) {
              visible.push(series);
            }
          }

          return visible;
        },
        await timezoneOf(actor),
      );
    },

    async getSeries(actor, seriesId) {
      const scope = await teacherScopeOf(repo, actor);
      assertAllowed(actor, 'events:read', { assignedToClass: scope === null ? undefined : true });

      return attempt(
        async () => {
          const found = await repo.getSeries(actor.userId, actor.orgId, seriesId);
          if (!found) {
            throw new ClassNotFoundError();
          }
          if (scope !== null) {
            const days = await repo.listSeriesOccurrences(actor.userId, actor.orgId, seriesId);
            if (!days.some(d => scope.classIds.has(d.id))) {
              throw new ClassNotFoundError();
            }
          }

          return found;
        },
        await timezoneOf(actor),
      );
    },

    async listSeriesOccurrences(actor, seriesId) {
      const scope = await teacherScopeOf(repo, actor);
      assertAllowed(actor, 'events:read', { assignedToClass: scope === null ? undefined : true });

      return attempt(
        async () => {
          const days = await repo.listSeriesOccurrences(actor.userId, actor.orgId, seriesId);

          return scope === null ? days : days.filter(d => scope.classIds.has(d.id));
        },
        await timezoneOf(actor),
      );
    },

    async updateSeries(actor, seriesId, input) {
      const scope = await teacherScopeOf(repo, actor);
      const detailsOnly = !can(actor, 'classes:manage');
      if (detailsOnly) {
        // A teacher may change the name of a series it teaches, and nothing else (as for a class: see updateClass).
        const days = scope === null ? [] : await repo.listSeriesOccurrences(actor.userId, actor.orgId, seriesId);
        assertAllowed(actor, 'events:update_details', {
          assignedToClass: scope === null ? undefined : days.some(d => scope.classIds.has(d.id)),
        });
      } else {
        assertAllowed(actor, 'classes:manage');
      }
      const timeZone = await timezoneOf(actor);

      return attempt(async () => {
        const existing = await repo.getSeries(actor.userId, actor.orgId, seriesId);
        if (!existing) {
          throw new ClassNotFoundError();
        }
        if (detailsOnly) {
          const locked = seriesFieldsOutsideDetails(detailsOfSeries(existing), detailsOfInput(input));
          if (locked.length > 0) {
            throw new TeacherFieldRefusedError(locked);
          }
        }
        // The schedule is null when the weekdays and times are as saved (a teacher's edit never changes them).
        const stored = await repo.listSeriesOccurrences(actor.userId, actor.orgId, seriesId);
        const schedule = detailsOnly ? null : await scheduleOfSeries(repo, actor, existing, stored, input, timeZone);

        // The series may move to another location, or gain days: its kept active days and its added days must not overlap a class in
        // their location. Removed days take no place, so they are left out.
        const removed = new Set(schedule?.removeIds ?? []);
        const kept = activeDays(
          stored.filter(d => !removed.has(d.id)),
          timeZone,
        );
        const added = (schedule?.add ?? []).map(o => dayOf(o, timeZone));
        const others = otherPlaces(await repo.listCampClassSpans(actor.userId, actor.orgId), seriesId);
        assertNoLocationClash({ name: input.name, location: input.location }, [...kept, ...added], others, timeZone);

        return repo.updateSeries(actor, seriesId, fieldsOf(input), schedule);
      }, timeZone);
    },

    async deleteSeries(actor, seriesId) {
      assertAllowed(actor, 'classes:manage');

      return attempt(
        async () => {
          await repo.deleteSeries(actor, seriesId);

          return null;
        },
        await timezoneOf(actor),
      );
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

      return attempt(async () => {
        await requireNameFree(repo, actor, checked.data.name, sessionId);

        // The repository plans the flags and refuses a shrink that would flag a class with people on it, in the same transaction
        // as the save (see sessionDateFlags in the domain).
        return repo.updateSession(actor, sessionId, checked.data);
      }, timeZone);
    },

    async previewSessionDates(actor, sessionId, input) {
      assertAllowed(actor, 'classes:manage');
      const timeZone = await timezoneOf(actor);
      const checked = NewSessionInputSchema.safeParse(input);
      if (!checked.success) {
        return {
          ok: false,
          failure: { reason: 'session_invalid', message: checked.error.issues[0]?.message ?? 'Check the session.' },
        };
      }
      const days = { startsOn: checked.data.startsOn, endsOn: checked.data.endsOn };

      return attempt(async () => {
        const plan = planSessionDates(
          await repo.sessionDatesPlanRows(actor.userId, actor.orgId, sessionId),
          days,
          timeZone,
        );

        return { outside: plan.outside, blocked: plan.blocked };
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
        const others = otherPlaces(await repo.listCampClassSpans(actor.userId, actor.orgId), null);
        assertNoLocationClash(
          { name: input.name, location: input.location },
          [dayOf(input, timeZone)],
          others,
          timeZone,
        );

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
        const others = otherPlaces(await repo.listCampClassSpans(actor.userId, actor.orgId), existing.seriesId);
        assertNoLocationClash(
          { name: input.name, location: input.location },
          [dayOf(input, timeZone)],
          others,
          timeZone,
        );
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

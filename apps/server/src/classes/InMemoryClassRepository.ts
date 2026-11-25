import { randomUUID } from 'node:crypto';
import type {
  Actor,
  ActiveEnrolmentFacts,
  AuditAction,
  DatesPlanClass,
  LocalDate,
  SessionDatesPlan,
} from '@buxa/domain';
import { capacityCovers, classDatesRefusal, planSessionDates, seatsLeft, sessionNameKey } from '@buxa/domain';
import type {
  Class,
  Enrolment,
  EnrolmentStatus,
  NewSessionInput,
  Series,
  Session,
  SessionDeleteImpact,
  SessionEditInput,
  SessionStatus,
} from '@buxa/contracts';
import { decideCancel, decideRestore, type OccurrenceCommand, type OccurrenceStatus } from '@buxa/domain';
import { OccurrenceRefusedError } from './errors';
import { seriesView } from './seriesView';
import { priceChangeAudit, samePrice } from './priceAudit';
import { sameSessionDetails, sessionEditAudit, type SessionDetails } from './sessionEditAudit';
import { systemClock, type Clock } from '../services/clock';
import type { AuditRecord } from '../people/InMemoryDatabase';
import type { AuditData } from '../audit/types';
import type {
  CampActiveHold,
  SeriesFields,
  SeriesRecord,
  CampClassSpan,
  CampWaitlistEntry,
  ClassRecord,
  ClassRepository,
  EnrolRequest,
  EnrolmentRule,
  GatheredEnrolmentFacts,
} from './ClassRepository';
import {
  CamperNotFoundError,
  CapacityBelowEnrolledError,
  ClassDatesFlaggedError,
  ClassHasEnrolmentsError,
  ClassNotFoundError,
  EnrolmentNotFoundError,
  InstructorNotFoundError,
  SessionDatesBlockedError,
  SessionHasClassesError,
  SessionHasEnrolmentsError,
  SessionNotDraftError,
  SessionNotFoundError,
  SessionNotLiveError,
  SessionPublishBlockedError,
  refusalError,
} from './errors';
import { settle } from '@buxa/domain';

/** A session (the parent): a date range. Dates are null until a class gives it one. */
interface StoredSession {
  id: string;
  orgId: string;
  name: string;
  description: string;
  startsOn: LocalDate | null;
  endsOn: LocalDate | null;
  isPublic: boolean;
  status: SessionStatus;
  archivedAt: string | null;
  createdAt: string;
}

/** A class: a time range under a session, with its own name, ages, camp size and location. */
interface StoredClass extends ClassRecord {
  id: string;
  orgId: string;
  sessionId: string;
  /** The dates flag (migration 0059): the class falls outside its session's dates. */
  datesOutsideSession: boolean;
  /** The series this day belongs to (migration 0060). */
  seriesId: string;
  /** Cancelled days keep their row and their reason (migration 0060). */
  status: OccurrenceStatus;
  cancelReason: string | null;
}

/** A series: the shared fields its days were written with, and its weekdays (migration 0060). */
interface StoredSeries extends SeriesFields {
  id: string;
  orgId: string;
  sessionId: string;
  weekdays: number[];
  seriesStartsAt: string;
  seriesEndsAt: string;
}

interface StoredEnrolment {
  id: string;
  orgId: string;
  classId: string;
  camperId: string;
  status: EnrolmentStatus;
  enrolledAt: string;
  overrideReason: string | null;
}
interface StoredCamper {
  id: string;
  orgId: string;
  name: string;
  dateOfBirth: LocalDate | null;
}

/**
 * A seat hold on a class, as Postgres stores it. A place is counted while it is unreleased and not yet expired. The household and
 * the child are kept for the camp-wide holds screen only.
 */
interface StoredSeatHold {
  id: string;
  classId: string;
  householdId: string;
  householdName: string;
  childName: string | null;
  createdAt: string;
  expiresAt: string;
  released: boolean;
}

/** Lets a test run the enrolment rule as a database would: a read, then a decision, then a write, with a gap between them. */
const yieldToDatabase = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

/**
 * In-memory adapter for sessions, classes and enrolments. Same errors, ordering and audit entries as Postgres.
 * A per-class lock stands in for `SELECT ... FOR UPDATE`: two enrolments into the same class run one after the other.
 */
export class InMemoryClassRepository implements ClassRepository {
  /** Every audit entry, in the order it was written. Tests read this; nothing else does. */
  readonly audit: AuditRecord[] = [];
  private readonly sessions = new Map<string, StoredSession>();
  private readonly classes = new Map<string, StoredClass>();
  private readonly enrolments = new Map<string, StoredEnrolment>();
  private readonly campers = new Map<string, StoredCamper>();
  /** Person id to the name of the household the person belongs to (Postgres: household_members). */
  private readonly householdOf = new Map<string, string>();
  private readonly seatHolds: StoredSeatHold[] = [];
  private readonly series = new Map<string, StoredSeries>();
  /** Camp id to the user ids that hold the teacher role there. */
  private readonly teacherUsers = new Map<string, Set<string>>();
  /** Person id to the login (user id) linked to that person (people.user_id, migration 0051). */
  private readonly loginOf = new Map<string, string>();
  private readonly locks = new Map<string, Promise<void>>();

  /** `timeZone` is the camp's zone for the dates check (Postgres reads it from the camp). */
  constructor(
    private readonly now: Clock = systemClock,
    private readonly timeZone: string = 'Australia/Sydney',
  ) {}

  /** Test setup: a person who can be enrolled (or named as an instructor). */
  seedCamper(orgId: string, id: string, name: string, dateOfBirth: LocalDate | null): void {
    this.campers.set(id, { id, orgId, name, dateOfBirth });
  }

  /** Test setup: the person is the login's roster person (as the invite accept links them). A teacher sees the classes it instructs. */
  linkPersonToLogin(personId: string, userId: string): void {
    this.loginOf.set(personId, userId);
  }

  /** Test setup: a person's household, as household_members would link them. Used for the waitlist's family name. */
  seedHouseholdMember(personId: string, householdName: string): void {
    this.householdOf.set(personId, householdName);
  }

  /**
   * Test setup: a seat hold on a class, as the hold repository would write it. Counts as a place while live. The household and
   * child default to a test family and no child.
   */
  seedSeatHold(
    classId: string,
    hold: {
      expiresAt: string;
      released: boolean;
      householdName?: string;
      childName?: string;
      createdAt?: string;
    },
  ): void {
    this.seatHolds.push({
      id: randomUUID(),
      classId,
      householdId: randomUUID(),
      householdName: hold.householdName ?? 'Test family',
      childName: hold.childName ?? null,
      createdAt: hold.createdAt ?? this.now().toISOString(),
      expiresAt: hold.expiresAt,
      released: hold.released,
    });
  }

  listSessions(userId: string, orgId: string): Promise<Session[]> {
    return settle(() =>
      [...this.sessions.values()]
        .filter(s => s.orgId === orgId)
        .sort(
          (a, b) =>
            (a.startsOn ?? '').localeCompare(b.startsOn ?? '') ||
            a.createdAt.localeCompare(b.createdAt) ||
            a.id.localeCompare(b.id),
        )
        .map(s => this.toSession(s)),
    );
  }

  getSession(userId: string, orgId: string, sessionId: string): Promise<Session | null> {
    return settle(() => {
      const found = this.sessionIn(orgId, sessionId);

      return found ? this.toSession(found) : null;
    });
  }

  createSession(actor: Actor, input: NewSessionInput): Promise<Session> {
    return settle(() => {
      const row: StoredSession = {
        id: randomUUID(),
        orgId: actor.orgId,
        name: input.name,
        description: input.description,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        isPublic: input.isPublic ?? false,
        status: 'draft',
        archivedAt: null,
        createdAt: this.now().toISOString(),
      };
      this.sessions.set(row.id, row);
      this.record(actor, 'session.create', 'session', row.id, { name: row.name });

      return this.toSession(row);
    });
  }

  updateSession(actor: Actor, sessionId: string, input: SessionEditInput): Promise<Session> {
    return settle(() => {
      const row = this.sessionIn(actor.orgId, sessionId);
      if (!row) {
        throw new SessionNotFoundError();
      }
      const before: SessionDetails = {
        name: row.name,
        description: row.description,
        startsOn: row.startsOn,
        endsOn: row.endsOn,
        isPublic: row.isPublic,
      };
      const after: SessionDetails = {
        name: input.name,
        description: input.description,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        isPublic: input.isPublic ?? false,
      };
      if (!sameSessionDetails(before, after)) {
        const datesChanged = before.startsOn !== after.startsOn || before.endsOn !== after.endsOn;
        const plan = datesChanged
          ? planSessionDates(
              this.datesPlanRowsOf(actor.orgId, sessionId),
              { startsOn: input.startsOn, endsOn: input.endsOn },
              this.timeZone,
            )
          : null;
        if (plan && plan.blocked.length > 0) {
          throw new SessionDatesBlockedError(plan.blocked.map(c => c.name));
        }
        if (plan) {
          this.applyDatesPlan(actor, sessionId, input, plan);
        }
        this.record(actor, 'session.update', 'session', sessionId, sessionEditAudit(before, after));
        Object.assign(row, after);
      }

      return this.toSession(row);
    });
  }

  deleteSession(actor: Actor, sessionId: string): Promise<void> {
    return settle(() => {
      const row = this.sessionIn(actor.orgId, sessionId);
      if (!row) {
        throw new SessionNotFoundError();
      }
      if ([...this.classes.values()].some(c => c.sessionId === sessionId)) {
        throw new SessionHasClassesError();
      }
      this.sessions.delete(sessionId);
      this.record(actor, 'session.delete', 'session', sessionId, { name: row.name });
    });
  }

  deleteSessionWithClasses(actor: Actor, sessionId: string): Promise<void> {
    return settle(() => {
      const row = this.sessionIn(actor.orgId, sessionId);
      if (!row) {
        throw new SessionNotFoundError();
      }
      const children = [...this.classes.values()].filter(c => c.sessionId === sessionId);
      const enrolled = [...this.enrolments.values()].some(e => children.some(c => c.id === e.classId));
      if (enrolled) {
        throw new SessionHasEnrolmentsError();
      }
      for (const child of children) {
        this.classes.delete(child.id);
        this.record(actor, 'class.delete', 'class', child.id, { name: child.name, session: row.name });
      }
      this.sessions.delete(sessionId);
      this.record(actor, 'session.delete', 'session', sessionId, { name: row.name, classes: children.length });
    });
  }

  setSessionArchived(actor: Actor, sessionId: string, archived: boolean): Promise<Session> {
    return settle(() => {
      const row = this.sessionIn(actor.orgId, sessionId);
      if (!row) {
        throw new SessionNotFoundError();
      }
      const from = row.status;
      if (archived) {
        row.status = 'archived';
        row.archivedAt = row.archivedAt ?? this.now().toISOString();
      } else if (row.status === 'archived') {
        row.status = 'live';
        row.archivedAt = null;
      } else {
        return this.toSession(row);
      }
      this.record(actor, archived ? 'session.archive' : 'session.unarchive', 'session', sessionId, { from });

      return this.toSession(row);
    });
  }

  publishSession(actor: Actor, sessionId: string): Promise<Session> {
    return settle(() => {
      const row = this.sessionIn(actor.orgId, sessionId);
      if (!row) {
        throw new SessionNotFoundError();
      }
      if (row.status === 'archived') {
        throw new SessionNotDraftError('archived');
      }
      if (row.status === 'draft') {
        const flagged = this.flaggedNamesOf(actor.orgId, sessionId);
        if (flagged.length > 0) {
          throw new SessionPublishBlockedError(flagged);
        }
        row.status = 'live';
        this.record(actor, 'session.publish', 'session', sessionId, {});
      }

      return this.toSession(row);
    });
  }

  sessionDeleteImpact(userId: string, orgId: string, sessionId: string): Promise<SessionDeleteImpact> {
    return settle(() => {
      if (!this.sessionIn(orgId, sessionId)) {
        throw new SessionNotFoundError();
      }
      const classes = [...this.classes.values()].filter(c => c.sessionId === sessionId);

      // Groups, rooms and assignments live in the group repository; a session here has none of them.
      return {
        classes: classes.length,
        groups: 0,
        rooms: 0,
        assignments: 0,
        instructors: classes.reduce((n, c) => n + c.instructorIds.length, 0),
        formLinks: 0,
      };
    });
  }

  deleteDraftSession(actor: Actor, sessionId: string): Promise<void> {
    return settle(() => {
      const row = this.sessionIn(actor.orgId, sessionId);
      if (!row) {
        throw new SessionNotFoundError();
      }
      if (row.status !== 'draft') {
        throw new SessionNotDraftError(row.status);
      }
      const children = [...this.classes.values()].filter(c => c.sessionId === sessionId);
      for (const child of children) {
        this.classes.delete(child.id);
        this.record(actor, 'class.delete', 'class', child.id, { name: child.name, session: row.name });
      }
      this.sessions.delete(sessionId);
      this.record(actor, 'session.delete', 'session', sessionId, {
        name: row.name,
        status: 'draft',
        classes: children.length,
      });
    });
  }

  sessionNameTaken(_userId: string, orgId: string, name: string, exceptId: string | null): Promise<string | null> {
    return settle(() => {
      const key = sessionNameKey(name);
      const same = [...this.sessions.values()].find(
        s => s.orgId === orgId && s.id !== exceptId && sessionNameKey(s.name) === key,
      );

      return same?.name ?? null;
    });
  }

  setSessionPublic(actor: Actor, sessionId: string, isPublic: boolean): Promise<Session> {
    return settle(() => {
      const row = this.sessionIn(actor.orgId, sessionId);
      if (!row) {
        throw new SessionNotFoundError();
      }
      row.isPublic = isPublic;
      this.record(actor, 'session.update', 'session', sessionId, { isPublic });

      return this.toSession(row);
    });
  }

  setOccurrenceStatus(actor: Actor, occurrenceId: string, command: OccurrenceCommand): Promise<void> {
    return settle(() => {
      const row = this.classIn(actor.orgId, occurrenceId);
      if (!row) {
        throw new ClassNotFoundError();
      }
      if (command.kind === 'cancel') {
        if (decideCancel(row).kind === 'refuse') {
          throw new OccurrenceRefusedError('already_cancelled');
        }
        row.status = 'cancelled';
        row.cancelReason = command.reason;
        this.record(actor, 'occurrence.cancel', 'occurrence', occurrenceId, {
          classId: row.sessionId,
          reason: command.reason,
        });

        return;
      }
      if (decideRestore(row).kind === 'refuse') {
        throw new OccurrenceRefusedError('not_cancelled');
      }
      row.status = 'active';
      row.cancelReason = null;
      this.record(actor, 'occurrence.restore', 'occurrence', occurrenceId, { classId: row.sessionId });
    });
  }

  addSeries(actor: Actor, sessionId: string, input: SeriesRecord): Promise<Series> {
    return settle(() => {
      if (!this.sessionIn(actor.orgId, sessionId)) {
        throw new SessionNotFoundError();
      }
      // Check everything before writing anything, so a failure part-way leaves the camp unchanged (as the transaction does).
      this.requireInstructorsInCamp(actor.orgId, input.instructorIds);
      const seriesId = randomUUID();
      const stored: StoredSeries = {
        id: seriesId,
        orgId: actor.orgId,
        sessionId,
        name: input.name,
        ageRange: input.ageRange,
        capacity: input.capacity,
        location: input.location,
        instructorIds: [...new Set(input.instructorIds)],
        price: input.price,
        weekdays: [...input.weekdays],
        seriesStartsAt: input.seriesStartsAt,
        seriesEndsAt: input.seriesEndsAt,
      };
      this.series.set(seriesId, stored);
      for (const day of input.occurrences) {
        const dayInput: ClassRecord = { ...input, startsAt: day.startsAt, endsAt: day.endsAt };
        const row = this.storeDay(actor, sessionId, seriesId, dayInput);
        this.recordCreate(actor, row, dayInput);
      }
      this.record(actor, 'series.create', 'series', seriesId, {
        sessionId,
        name: input.name,
        weekdays: input.weekdays.map(String),
        days: input.occurrences.length,
      });

      return this.toSeries(stored);
    });
  }

  listSeries(userId: string, orgId: string, sessionId: string): Promise<Series[]> {
    return settle(() => {
      if (!this.sessionIn(orgId, sessionId)) {
        throw new SessionNotFoundError();
      }

      return [...this.series.values()]
        .filter(sr => sr.orgId === orgId && sr.sessionId === sessionId)
        .sort((a, b) => a.seriesStartsAt.localeCompare(b.seriesStartsAt) || a.id.localeCompare(b.id))
        .map(sr => this.toSeries(sr));
    });
  }

  getSeries(userId: string, orgId: string, seriesId: string): Promise<Series | null> {
    return settle(() => {
      const found = this.seriesIn(orgId, seriesId);

      return found ? this.toSeries(found) : null;
    });
  }

  listSeriesOccurrences(userId: string, orgId: string, seriesId: string): Promise<Class[]> {
    return settle(() =>
      this.daysOf(seriesId)
        .filter(c => c.orgId === orgId)
        .map(c => this.toClass(c)),
    );
  }

  updateSeries(actor: Actor, seriesId: string, input: SeriesFields): Promise<Series> {
    return settle(() => {
      const row = this.seriesIn(actor.orgId, seriesId);
      if (!row) {
        throw new ClassNotFoundError();
      }
      this.requireInstructorsInCamp(actor.orgId, input.instructorIds);
      const days = this.daysOf(seriesId);
      // As in Postgres: the camp size cannot go below the seats the series has taken (enrolled campers and live holds).
      const first = days[0];
      if (first && !capacityCovers(input.capacity, this.takenPlaces(first.id))) {
        throw new CapacityBelowEnrolledError();
      }
      const priceBefore = row.price;
      const instructorIds = [...new Set(input.instructorIds)];
      Object.assign(row, input, { instructorIds });
      for (const day of days) {
        Object.assign(day, input, { instructorIds });
      }
      this.record(actor, 'series.update', 'series', seriesId, {
        name: row.name,
        capacity: row.capacity,
        instructorIds,
        days: days.length,
      });
      if (!samePrice(priceBefore, input.price)) {
        this.record(actor, 'series.update', 'series', seriesId, priceChangeAudit(priceBefore, input.price));
      }

      return this.toSeries(row);
    });
  }

  deleteSeries(actor: Actor, seriesId: string): Promise<void> {
    return settle(() => {
      const row = this.seriesIn(actor.orgId, seriesId);
      if (!row) {
        throw new ClassNotFoundError();
      }
      const holdsOrEnrolments =
        [...this.enrolments.values()].some(e => this.seriesKey(e.classId) === seriesId) ||
        this.seatHolds.some(h => this.seriesKey(h.classId) === seriesId);
      if (holdsOrEnrolments) {
        throw new ClassHasEnrolmentsError();
      }
      for (const day of this.daysOf(seriesId)) {
        this.classes.delete(day.id);
      }
      this.series.delete(seriesId);
      this.record(actor, 'series.delete', 'series', seriesId, { name: row.name });
    });
  }

  /** Writes one day of a series and returns it. The caller audits it. */
  private storeDay(actor: Actor, sessionId: string, seriesId: string, input: ClassRecord): StoredClass {
    const row: StoredClass = {
      ...input,
      id: randomUUID(),
      orgId: actor.orgId,
      sessionId,
      datesOutsideSession: false,
      seriesId,
      status: 'active',
      cancelReason: null,
    };
    this.classes.set(row.id, row);

    return row;
  }

  listCampClassSpans(userId: string, orgId: string): Promise<CampClassSpan[]> {
    return settle(() =>
      [...this.classes.values()]
        .filter(c => c.orgId === orgId)
        .map(c => ({ startsAt: c.startsAt, endsAt: c.endsAt, className: c.name }))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    );
  }

  camperNameOf(_userId: string, orgId: string, camperId: string): Promise<string | null> {
    return settle(() => {
      const camper = this.camperIn(orgId, camperId);

      return camper ? camper.name : null;
    });
  }

  listClasses(userId: string, orgId: string, sessionId: string): Promise<Class[]> {
    return settle(() => {
      if (!this.sessionIn(orgId, sessionId)) {
        throw new SessionNotFoundError();
      }

      return [...this.classes.values()]
        .filter(c => c.orgId === orgId && c.sessionId === sessionId)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
        .map(c => this.toClass(c));
    });
  }

  getClass(userId: string, orgId: string, classId: string): Promise<Class | null> {
    return settle(() => {
      const found = this.classIn(orgId, classId);

      return found ? this.toClass(found) : null;
    });
  }

  addClass(actor: Actor, sessionId: string, input: ClassRecord): Promise<Class> {
    return settle(() => {
      if (!this.sessionIn(actor.orgId, sessionId)) {
        throw new SessionNotFoundError();
      }
      this.requireInstructorsInCamp(actor.orgId, input.instructorIds);
      // A day written on its own gets a series of its own, as the database trigger does (migration 0060).
      const seriesId = randomUUID();
      this.series.set(seriesId, {
        id: seriesId,
        orgId: actor.orgId,
        sessionId,
        ...input,
        weekdays: [],
        seriesStartsAt: input.startsAt,
        seriesEndsAt: input.endsAt,
      });
      const row = this.storeDay(actor, sessionId, seriesId, input);
      this.recordCreate(actor, row, input);

      return this.toClass(row);
    });
  }

  updateClass(actor: Actor, classId: string, input: ClassRecord): Promise<Class> {
    return settle(() => {
      const row = this.classIn(actor.orgId, classId);
      if (!row) {
        throw new ClassNotFoundError();
      }
      this.requireInstructorsInCamp(actor.orgId, input.instructorIds);
      // As in Postgres: the camp size cannot go below the seats already taken (enrolled campers and live holds).
      if (!capacityCovers(input.capacity, this.takenPlaces(classId))) {
        throw new CapacityBelowEnrolledError();
      }
      const priceBefore = row.price;
      Object.assign(row, input, { instructorIds: [...new Set(input.instructorIds)] });
      // The service refused a class outside its session's dates, so a saved class is inside them: its flag is cleared (migration 0059).
      row.datesOutsideSession = false;
      this.record(actor, 'class.update', 'class', classId, {
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        capacity: row.capacity,
        instructorIds: row.instructorIds,
      });
      if (!samePrice(priceBefore, input.price)) {
        this.record(actor, 'class.price_change', 'class', classId, priceChangeAudit(priceBefore, input.price));
      }

      return this.toClass(row);
    });
  }

  deleteClass(actor: Actor, classId: string): Promise<void> {
    return settle(() => {
      const row = this.classIn(actor.orgId, classId);
      if (!row) {
        throw new ClassNotFoundError();
      }
      // A day is part of its series (migration 0065): the series' enrolments and holds refuse the delete, as in Postgres.
      const key = this.seriesKey(classId);
      const placesOrHolds =
        [...this.enrolments.values()].some(e => this.seriesKey(e.classId) === key) ||
        this.seatHolds.some(h => this.seriesKey(h.classId) === key);
      if (placesOrHolds) {
        throw new ClassHasEnrolmentsError();
      }
      this.classes.delete(classId);
      this.record(actor, 'class.delete', 'class', classId, { name: row.name });
    });
  }

  listCampActiveHolds(userId: string, orgId: string): Promise<CampActiveHold[]> {
    return settle(() => {
      const now = this.now().getTime();
      const live = this.seatHolds.filter(h => !h.released && Date.parse(h.expiresAt) > now);
      const inCamp = live.filter(h => this.classes.get(h.classId)?.orgId === orgId);

      return inCamp
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt) || a.id.localeCompare(b.id))
        .map(h => {
          const cls = this.classes.get(h.classId);
          const session = cls ? this.sessions.get(cls.sessionId) : undefined;

          return {
            id: h.id,
            sessionId: cls?.sessionId ?? '',
            sessionName: session?.name ?? '',
            classId: h.classId,
            className: cls?.name ?? '',
            householdId: h.householdId,
            householdName: h.householdName,
            childName: h.childName,
            createdAt: h.createdAt,
            expiresAt: h.expiresAt,
          };
        });
    });
  }

  listCampWaitlists(userId: string, orgId: string): Promise<CampWaitlistEntry[]> {
    return settle(() => {
      const waiting = [...this.enrolments.values()].filter(e => e.orgId === orgId && e.status === 'waitlisted');
      const startOf = (classId: string) => this.classes.get(classId)?.startsAt ?? '';

      return waiting
        .sort(
          (a, b) =>
            startOf(a.classId).localeCompare(startOf(b.classId)) ||
            a.classId.localeCompare(b.classId) ||
            a.enrolledAt.localeCompare(b.enrolledAt),
        )
        .map(e => {
          const cls = this.classes.get(e.classId);
          const session = cls ? this.sessions.get(cls.sessionId) : undefined;

          return {
            enrolmentId: e.id,
            sessionId: cls?.sessionId ?? '',
            sessionName: session?.name ?? '',
            classId: e.classId,
            className: cls?.name ?? '',
            householdName: this.householdOf.get(e.camperId) ?? null,
            camperName: this.campers.get(e.camperId)?.name ?? '',
            joinedAt: e.enrolledAt,
          };
        });
    });
  }

  listEnrolments(userId: string, orgId: string, classId: string): Promise<Enrolment[]> {
    return settle(() => {
      if (!this.classIn(orgId, classId)) {
        throw new ClassNotFoundError();
      }

      return [...this.enrolments.values()]
        .filter(e => e.orgId === orgId && this.seriesKey(e.classId) === this.seriesKey(classId))
        .sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt)) // stable: ties keep the order they were written in
        .map(e => this.toEnrolment(e));
    });
  }

  async enrol(actor: Actor, request: EnrolRequest, rule: EnrolmentRule): Promise<Enrolment> {
    return this.exclusive(request.classId, async () => {
      const cls = this.classIn(actor.orgId, request.classId);
      if (!cls) {
        throw new ClassNotFoundError();
      }
      const camper = this.camperIn(actor.orgId, request.camperId);
      if (!camper) {
        throw new CamperNotFoundError();
      }
      const parent = this.sessions.get(cls.sessionId);
      if (parent && parent.status !== 'live') {
        throw new SessionNotLiveError(parent.status);
      }
      const datesRefusal = classDatesRefusal(cls.datesOutsideSession);
      if (datesRefusal !== null) {
        throw new ClassDatesFlaggedError();
      }
      // As in Postgres: expired holds give their places back and the waitlist takes them, before the seat count is read.
      const undoSweep = this.sweepExpiredHolds(cls.id, actor);
      const facts: GatheredEnrolmentFacts = {
        session: {
          sessionId: cls.id,
          className: cls.name,
          startsAt: cls.startsAt,
          endsAt: cls.endsAt,
          capacity: cls.capacity,
          ageRange: cls.ageRange,
        },
        seatsTaken: this.takenPlaces(cls.id),
        camperDateOfBirth: camper.dateOfBirth,
        camperActive: this.activeFor(actor.orgId, camper.id),
      };
      // The facts are read now and the write happens after the round trip, as in Postgres. Only the lock keeps them current.
      await yieldToDatabase();
      const decision = rule(facts);
      if (decision.kind === 'refuse') {
        // A refusal rolls the whole write back in Postgres, so the sweep is undone too.
        undoSweep();
        throw refusalError(decision);
      }

      const row: StoredEnrolment = {
        id: randomUUID(),
        orgId: actor.orgId,
        classId: cls.id,
        camperId: camper.id,
        status: decision.status,
        enrolledAt: this.now().toISOString(),
        overrideReason: decision.overrode?.reason ?? null,
      };
      this.enrolments.set(row.id, row);
      this.record(actor, 'enrolment.create', 'enrolment', row.id, {
        sessionId: cls.id,
        camperId: camper.id,
        status: decision.status,
      });
      if (decision.overrode) {
        this.record(actor, 'enrolment.override', 'enrolment', row.id, {
          sessionId: cls.id,
          camperId: camper.id,
          reason: decision.overrode.reason,
          clashSessionId: decision.overrode.clash.sessionId,
        });
      }

      return this.toEnrolment(row);
    });
  }

  async cancelEnrolment(actor: Actor, enrolmentId: string, note: string | null): Promise<Enrolment> {
    const existing = this.enrolments.get(enrolmentId);
    if (!existing || existing.orgId !== actor.orgId || existing.status === 'cancelled') {
      throw new EnrolmentNotFoundError();
    }

    return this.exclusive(existing.classId, () => {
      return settle(() => {
        const row = this.enrolments.get(enrolmentId);
        if (!row || row.orgId !== actor.orgId || row.status === 'cancelled') {
          throw new EnrolmentNotFoundError();
        }
        // Only a place that was really taken goes to the waitlist; a cancelled waitlist entry frees nothing (as in Postgres).
        const freedPlace = row.status === 'enrolled';
        row.status = 'cancelled';
        this.record(actor, 'enrolment.cancel', 'enrolment', row.id, {
          sessionId: row.classId,
          camperId: row.camperId,
          note,
        });
        if (freedPlace) {
          this.promoteWaitlist(row.classId, actor);
        }

        return this.toEnrolment(row);
      });
    });
  }

  /** Test seed: a member of the camp with the teacher role (Postgres keeps this in org_members). */
  seedTeacher(orgId: string, userId: string): void {
    const set = this.teacherUsers.get(orgId) ?? new Set<string>();
    set.add(userId);
    this.teacherUsers.set(orgId, set);
  }

  assignedClassIds(userId: string, orgId: string, teacherId: string): Promise<string[]> {
    if (!this.teacherUsers.get(orgId)?.has(teacherId)) {
      return Promise.resolve([]);
    }
    // As in Postgres: a class is the teacher's when one of its instructors is the person linked to the teacher's login.
    const ids = [...this.classes.values()]
      .filter(c => c.orgId === orgId && c.instructorIds.some(personId => this.loginOf.get(personId) === teacherId))
      .map(c => c.id);

    return Promise.resolve(ids);
  }

  camperIdsIn(userId: string, orgId: string, classIds: readonly string[]): Promise<string[]> {
    const wanted = new Set(classIds);
    const ids = new Set<string>();
    for (const e of this.enrolments.values()) {
      if (e.orgId === orgId && wanted.has(e.classId) && e.status === 'enrolled') {
        ids.add(e.camperId);
      }
    }

    return Promise.resolve([...ids]);
  }

  private async exclusive<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    const run = previous.then(work);
    this.locks.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );

    return run;
  }

  private record(actor: Actor, action: AuditAction, entity: string, entityId: string, data: AuditData): void {
    this.audit.push({ orgId: actor.orgId, actorId: actor.userId, action, entity, entityId, data });
  }

  /** The classes of a session with what a date change needs (as readDatesPlanRows does in Postgres). */
  private datesPlanRowsOf(orgId: string, sessionId: string): DatesPlanClass[] {
    return [...this.classes.values()]
      .filter(c => c.orgId === orgId && c.sessionId === sessionId)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
      .map(c => ({
        id: c.id,
        name: c.name,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        datesOutsideSession: c.datesOutsideSession,
        hasPeople:
          [...this.enrolments.values()].some(e => e.classId === c.id) || this.seatHolds.some(h => h.classId === c.id),
      }));
  }

  private flaggedNamesOf(orgId: string, sessionId: string): string[] {
    return this.datesPlanRowsOf(orgId, sessionId)
      .filter(c => c.datesOutsideSession)
      .map(c => c.name);
  }

  /** Sets the flags of a plan on the session's classes, then audits each newly flagged class (as applyDatesPlan does in Postgres). */
  private applyDatesPlan(
    actor: Actor,
    sessionId: string,
    input: { name: string; startsOn: string; endsOn: string },
    plan: SessionDatesPlan,
  ): void {
    for (const c of this.classes.values()) {
      if (c.orgId === actor.orgId && c.sessionId === sessionId) {
        c.datesOutsideSession = plan.outside.some(o => o.id === c.id);
      }
    }
    for (const cls of plan.newlyFlagged) {
      this.record(actor, 'class.dates_flagged', 'class', cls.id, {
        name: cls.name,
        session: input.name,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
      });
    }
  }

  sessionDatesPlanRows(_userId: string, orgId: string, sessionId: string): Promise<DatesPlanClass[]> {
    return settle(() => {
      if (!this.sessionIn(orgId, sessionId)) {
        throw new SessionNotFoundError();
      }

      return this.datesPlanRowsOf(orgId, sessionId);
    });
  }

  private sessionIn(orgId: string, id: string): StoredSession | undefined {
    const s = this.sessions.get(id);

    return s && s.orgId === orgId ? s : undefined;
  }

  private classIn(orgId: string, id: string): StoredClass | undefined {
    const c = this.classes.get(id);

    return c && c.orgId === orgId ? c : undefined;
  }

  private camperIn(orgId: string, id: string): StoredCamper | undefined {
    const c = this.campers.get(id);

    return c && c.orgId === orgId ? c : undefined;
  }

  /** As in Postgres: every instructor must be a person in this camp. */
  private requireInstructorsInCamp(orgId: string, instructorIds: readonly string[]): void {
    if (instructorIds.some(id => !this.camperIn(orgId, id))) {
      throw new InstructorNotFoundError();
    }
  }

  private countWhere(classId: string, status: EnrolmentStatus): number {
    const key = this.seriesKey(classId);

    return [...this.enrolments.values()].filter(e => this.seriesKey(e.classId) === key && e.status === status).length;
  }

  /** Places taken: enrolled campers plus live holds (as `session_seats_taken` counts them in Postgres). Waitlisted campers hold none. */
  private takenPlaces(classId: string): number {
    const now = this.now().getTime();
    const key = this.seriesKey(classId);
    const holds = this.seatHolds.filter(
      h => this.seriesKey(h.classId) === key && !h.released && Date.parse(h.expiresAt) > now,
    ).length;

    return this.countWhere(classId, 'enrolled') + holds;
  }

  /**
   * Moves the first waitlisted campers (in the order they joined) into the places that are free now, as `promoteWaitlist` does in
   * Postgres. Each promotion is audited under the actor that freed the place. Returns the campers promoted.
   */
  private promoteWaitlist(classId: string, actor: Actor): StoredEnrolment[] {
    const cls = this.classes.get(classId);
    if (!cls) {
      return [];
    }
    const free = seatsLeft(cls.capacity, this.takenPlaces(classId));
    const waiting = [...this.enrolments.values()]
      .filter(e => e.classId === classId && e.status === 'waitlisted')
      .slice(0, free);
    for (const e of waiting) {
      e.status = 'enrolled';
      this.record(actor, 'enrolment.promote', 'enrolment', e.id, { sessionId: classId, camperId: e.camperId });
    }

    return waiting;
  }

  /**
   * Releases the class's expired holds, then promotes the waitlist into the places they return (Postgres does this under the session
   * lock at the start of an enrolment). Returns an undo that restores the holds, the waitlist and the audit log, for a refused write.
   */
  private sweepExpiredHolds(classId: string, actor: Actor): () => void {
    const now = this.now().getTime();
    const released = this.seatHolds.filter(h => h.classId === classId && !h.released && Date.parse(h.expiresAt) <= now);
    for (const h of released) {
      h.released = true;
    }
    const auditMark = this.audit.length;
    const promoted = this.promoteWaitlist(classId, actor);

    return () => {
      for (const h of released) {
        h.released = false;
      }
      for (const e of promoted) {
        e.status = 'waitlisted';
      }
      this.audit.splice(auditMark);
    };
  }

  /** The camper's enrolled and waitlisted classes in the camp. Cancelled ones free their time. */
  private activeFor(orgId: string, camperId: string): ActiveEnrolmentFacts[] {
    const out: ActiveEnrolmentFacts[] = [];
    for (const e of this.enrolments.values()) {
      if (e.orgId !== orgId || e.camperId !== camperId || e.status === 'cancelled') {
        continue;
      }
      const c = this.classes.get(e.classId);
      if (c) {
        out.push({ sessionId: c.id, className: c.name, startsAt: c.startsAt, endsAt: c.endsAt });
      }
    }

    return out;
  }

  private toSession(s: StoredSession): Session {
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      startsOn: s.startsOn,
      endsOn: s.endsOn,
      classCount: [...this.series.values()].filter(sr => sr.sessionId === s.id).length,
      isPublic: s.isPublic,
      status: s.status,
      archivedAt: s.archivedAt,
      createdAt: s.createdAt,
    };
  }

  private toClass(c: StoredClass): Class {
    const session = this.sessions.get(c.sessionId);

    return {
      id: c.id,
      sessionId: c.sessionId,
      sessionName: session?.name ?? '',
      name: c.name,
      ageRange: { ...c.ageRange },
      capacity: c.capacity,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      location: c.location,
      instructorIds: [...c.instructorIds],
      instructors: c.instructorIds.map(id => ({ id, name: this.campers.get(id)?.name ?? '' })),
      seatsTaken: this.takenPlaces(c.id),
      waitlisted: this.countWhere(c.id, 'waitlisted'),
      price: c.price ? { ...c.price } : null,
      datesOutsideSession: c.datesOutsideSession,
      seriesId: c.seriesId,
      occurrenceStatus: c.status,
      cancelReason: c.cancelReason,
    };
  }

  private toSeries(sr: StoredSeries): Series {
    return seriesView(sr, this.daysOf(sr.id), this.sessions.get(sr.sessionId)?.name ?? '', this.timeZone, {
      seatsTaken: (classId: string) => this.takenPlaces(classId),
      waitlisted: (classId: string) => this.countWhere(classId, 'waitlisted'),
      instructorName: (id: string) => this.campers.get(id)?.name ?? '',
    });
  }

  private daysOf(seriesId: string): StoredClass[] {
    return [...this.classes.values()]
      .filter(c => c.seriesId === seriesId)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  /** The key a place is counted under: the series of the day the row points at (migration 0061). */
  private seriesKey(classId: string): string {
    return this.classes.get(classId)?.seriesId ?? classId;
  }

  private seriesIn(orgId: string, id: string): StoredSeries | undefined {
    const found = this.series.get(id);

    return found && found.orgId === orgId ? found : undefined;
  }

  /** Audits a new class, and `class.price_change` when it is created with a price (as Postgres does). */
  private recordCreate(actor: Actor, row: StoredClass, input: ClassRecord): void {
    this.record(actor, 'class.create', 'class', row.id, {
      sessionId: row.sessionId,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      instructorIds: [...new Set(input.instructorIds)],
    });
    if (input.price) {
      this.record(actor, 'class.price_change', 'class', row.id, priceChangeAudit(null, input.price));
    }
  }

  private toEnrolment(e: StoredEnrolment): Enrolment {
    const c = this.classes.get(e.classId);
    const camper = this.campers.get(e.camperId);

    return {
      id: e.id,
      classId: e.classId,
      className: c?.name ?? '',
      camperId: e.camperId,
      camperName: camper?.name ?? '',
      status: e.status,
      enrolledAt: e.enrolledAt,
      overrideReason: e.overrideReason,
    };
  }
}

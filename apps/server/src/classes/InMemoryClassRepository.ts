import { randomUUID } from 'node:crypto';
import type { Actor, ActiveEnrolmentFacts, AuditAction, LocalDate } from '@buxa/domain';
import type { Class, Enrolment, EnrolmentStatus, NewSessionInput, Session, SessionPriceInput } from '@buxa/contracts';
import { priceChangeAudit, samePrice } from './priceAudit';
import { systemClock, type Clock } from '../services/clock';
import type { AuditRecord } from '../people/InMemoryDatabase';
import type { AuditData } from '../audit/types';
import type {
  ClassRecord,
  ClassRepository,
  EnrolRequest,
  EnrolmentRule,
  GatheredEnrolmentFacts,
} from './ClassRepository';
import {
  CamperNotFoundError,
  CapacityBelowEnrolledError,
  ClassHasEnrolmentsError,
  ClassNotFoundError,
  EnrolmentNotFoundError,
  InstructorNotFoundError,
  SessionNotFoundError,
  TeacherNotFoundError,
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
  createdAt: string;
  price: SessionPriceInput | null;
}

/** A class: a time range under a session, with its own name, ages, camp size and location. */
interface StoredClass extends ClassRecord {
  id: string;
  orgId: string;
  sessionId: string;
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
  /** Camp id to the user ids that hold the teacher role there. */
  private readonly teacherUsers = new Map<string, Set<string>>();
  /** Class id to the teacher user ids assigned to it. */
  private readonly teachersOf = new Map<string, Set<string>>();
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly now: Clock = systemClock) {}

  /** Test setup: a person who can be enrolled (or named as an instructor). */
  seedCamper(orgId: string, id: string, name: string, dateOfBirth: LocalDate | null): void {
    this.campers.set(id, { id, orgId, name, dateOfBirth });
  }

  listSessions(orgId: string): Promise<Session[]> {
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

  getSession(orgId: string, sessionId: string): Promise<Session | null> {
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
        createdAt: this.now().toISOString(),
        price: input.price ?? null,
      };
      this.sessions.set(row.id, row);
      this.record(actor, 'session.create', 'session', row.id, { name: row.name });
      if (row.price) {
        this.record(actor, 'session.price_change', 'session', row.id, priceChangeAudit(null, row.price));
      }

      return this.toSession(row);
    });
  }

  setSessionPrice(actor: Actor, sessionId: string, price: SessionPriceInput | null): Promise<Session> {
    return settle(() => {
      const row = this.sessionIn(actor.orgId, sessionId);
      if (!row) {
        throw new SessionNotFoundError();
      }
      if (!samePrice(row.price, price)) {
        this.record(actor, 'session.price_change', 'session', sessionId, priceChangeAudit(row.price, price));
        row.price = price;
      }

      return this.toSession(row);
    });
  }

  listClasses(orgId: string, sessionId: string): Promise<Class[]> {
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

  getClass(orgId: string, classId: string): Promise<Class | null> {
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
      const row: StoredClass = { ...input, id: randomUUID(), orgId: actor.orgId, sessionId };
      this.classes.set(row.id, row);
      this.record(actor, 'class.create', 'class', row.id, {
        sessionId,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        instructorIds: [...new Set(input.instructorIds)],
      });

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
      // As in Postgres: the camp size cannot go below the seats already taken.
      if (input.capacity < this.countWhere(classId, 'enrolled')) {
        throw new CapacityBelowEnrolledError();
      }
      Object.assign(row, input, { instructorIds: [...new Set(input.instructorIds)] });
      this.record(actor, 'class.update', 'class', classId, {
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        capacity: row.capacity,
        instructorIds: row.instructorIds,
      });

      return this.toClass(row);
    });
  }

  deleteClass(actor: Actor, classId: string): Promise<void> {
    return settle(() => {
      const row = this.classIn(actor.orgId, classId);
      if (!row) {
        throw new ClassNotFoundError();
      }
      if ([...this.enrolments.values()].some(e => e.classId === classId)) {
        throw new ClassHasEnrolmentsError();
      }
      this.classes.delete(classId);
      this.record(actor, 'class.delete', 'class', classId, { name: row.name });
    });
  }

  listEnrolments(orgId: string, classId: string): Promise<Enrolment[]> {
    return settle(() => {
      if (!this.classIn(orgId, classId)) {
        throw new ClassNotFoundError();
      }

      return [...this.enrolments.values()]
        .filter(e => e.orgId === orgId && e.classId === classId)
        .sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt) || a.id.localeCompare(b.id))
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
      const facts: GatheredEnrolmentFacts = {
        session: {
          sessionId: cls.id,
          className: cls.name,
          startsAt: cls.startsAt,
          endsAt: cls.endsAt,
          capacity: cls.capacity,
          ageRange: cls.ageRange,
        },
        seatsTaken: this.countWhere(cls.id, 'enrolled'),
        camperDateOfBirth: camper.dateOfBirth,
        camperActive: this.activeFor(actor.orgId, camper.id),
      };
      // The facts are read now and the write happens after the round trip, as in Postgres. Only the lock keeps them current.
      await yieldToDatabase();
      const decision = rule(facts);
      if (decision.kind === 'refuse') {
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
        row.status = 'cancelled';
        this.record(actor, 'enrolment.cancel', 'enrolment', row.id, {
          sessionId: row.classId,
          camperId: row.camperId,
          note,
        });

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

  assignedClassIds(orgId: string, userId: string): Promise<string[]> {
    if (!this.teacherUsers.get(orgId)?.has(userId)) {
      return Promise.resolve([]);
    }
    const ids = [...this.classes.values()]
      .filter(c => c.orgId === orgId && this.teachersOf.get(c.id)?.has(userId))
      .map(c => c.id);

    return Promise.resolve(ids);
  }

  camperIdsIn(orgId: string, classIds: readonly string[]): Promise<string[]> {
    const wanted = new Set(classIds);
    const ids = new Set<string>();
    for (const e of this.enrolments.values()) {
      if (e.orgId === orgId && wanted.has(e.classId) && e.status === 'enrolled') {
        ids.add(e.camperId);
      }
    }

    return Promise.resolve([...ids]);
  }

  async replaceTeachers(actor: Actor, classId: string, userIds: readonly string[]): Promise<void> {
    const existing = this.classIn(actor.orgId, classId);
    if (!existing) {
      throw new ClassNotFoundError();
    }
    const unique = [...new Set(userIds)];
    const members = this.teacherUsers.get(actor.orgId) ?? new Set<string>();
    if (unique.some(id => !members.has(id))) {
      throw new TeacherNotFoundError();
    }
    this.teachersOf.set(classId, new Set(unique));
    this.record(actor, 'class.update', 'class', classId, { teacherIds: unique });
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
    return [...this.enrolments.values()].filter(e => e.classId === classId && e.status === status).length;
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
      classCount: [...this.classes.values()].filter(c => c.sessionId === s.id).length,
      createdAt: s.createdAt,
      price: s.price ? { ...s.price } : null,
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
      seatsTaken: this.countWhere(c.id, 'enrolled'),
      waitlisted: this.countWhere(c.id, 'waitlisted'),
      price: session?.price ? { ...session.price } : null,
    };
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

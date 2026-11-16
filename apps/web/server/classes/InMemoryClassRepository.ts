import { randomUUID } from 'node:crypto';
import type { Actor, ActiveEnrolmentFacts, AuditAction, LocalDate } from '@buxa/domain';
import type { Class, Enrolment, EnrolmentStatus, NewClassInput, Session } from '@buxa/contracts';
import { systemClock, type Clock } from '../services/clock';
import type { AuditRecord } from '../people/InMemoryDatabase';
import type { ClassRepository, EnrolRequest, EnrolmentRule, NewSessionRecord } from './ClassRepository';
import { ClassNotFoundError, CamperNotFoundError, EnrolmentNotFoundError, SessionNotFoundError, refusalError } from './errors';

interface StoredClass extends Class { orgId: string }
interface StoredSession extends NewSessionRecord { id: string; orgId: string; classId: string }
interface StoredEnrolment { id: string; orgId: string; sessionId: string; camperId: string; status: EnrolmentStatus; enrolledAt: string; overrideReason: string | null }
interface StoredCamper { id: string; orgId: string; name: string; dateOfBirth: LocalDate | null }

/** Lets a test run the enrolment rule as a database would: a read, then a decision, then a write, with a gap between them. */
const yieldToDatabase = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

/**
 * In-memory adapter for classes, sessions and enrolments. Same errors, ordering and audit entries as Postgres.
 * A per-session lock stands in for `SELECT ... FOR UPDATE`: two enrolments into the same session run one after the other.
 */
export class InMemoryClassRepository implements ClassRepository {
  /** Every audit entry, in the order it was written. Tests read this; nothing else does. */
  readonly audit: AuditRecord[] = [];
  private readonly classes = new Map<string, StoredClass>();
  private readonly sessions = new Map<string, StoredSession>();
  private readonly enrolments = new Map<string, StoredEnrolment>();
  private readonly campers = new Map<string, StoredCamper>();
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly now: Clock = systemClock) {}

  /** Test setup: a person who can be enrolled. */
  seedCamper(orgId: string, id: string, name: string, dateOfBirth: LocalDate | null): void {
    this.campers.set(id, { id, orgId, name, dateOfBirth });
  }

  async listClasses(orgId: string): Promise<Class[]> {
    return [...this.classes.values()].filter(c => c.orgId === orgId).sort(byCreated).map(toClass);
  }

  async getClass(orgId: string, classId: string): Promise<Class | null> {
    const found = this.classIn(orgId, classId);
    return found ? toClass(found) : null;
  }

  async createClass(actor: Actor, input: NewClassInput): Promise<Class> {
    const row: StoredClass = {
      id: randomUUID(), orgId: actor.orgId, name: input.name, description: input.description, ageRange: input.ageRange,
      capacity: input.capacity, instructorRatio: input.instructorRatio, createdAt: this.now().toISOString(),
    };
    this.classes.set(row.id, row);
    this.record(actor, 'class.create', 'class', row.id, { name: row.name });
    return toClass(row);
  }

  async addSession(actor: Actor, classId: string, input: NewSessionRecord): Promise<Session> {
    const cls = this.classIn(actor.orgId, classId);
    if (!cls) throw new ClassNotFoundError();
    const row: StoredSession = { ...input, id: randomUUID(), orgId: actor.orgId, classId };
    this.sessions.set(row.id, row);
    this.record(actor, 'session.create', 'session', row.id, { classId, startsAt: row.startsAt, endsAt: row.endsAt });
    return this.toSession(row, cls);
  }

  async listSessions(orgId: string, classId: string): Promise<Session[]> {
    const cls = this.classIn(orgId, classId);
    if (!cls) throw new ClassNotFoundError();
    return [...this.sessions.values()]
      .filter(s => s.orgId === orgId && s.classId === classId)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
      .map(s => this.toSession(s, cls));
  }

  async listEnrolments(orgId: string, sessionId: string): Promise<Enrolment[]> {
    const session = this.sessionIn(orgId, sessionId);
    if (!session) throw new SessionNotFoundError();
    return [...this.enrolments.values()]
      .filter(e => e.orgId === orgId && e.sessionId === sessionId)
      .sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt) || a.id.localeCompare(b.id))
      .map(e => this.toEnrolment(e));
  }

  async enrol(actor: Actor, request: EnrolRequest, rule: EnrolmentRule): Promise<Enrolment> {
    return this.exclusive(request.sessionId, async () => {
      const session = this.sessionIn(actor.orgId, request.sessionId);
      if (!session) throw new SessionNotFoundError();
      const cls = this.classIn(actor.orgId, session.classId);
      if (!cls) throw new ClassNotFoundError();
      await yieldToDatabase();
      const camper = this.camperIn(actor.orgId, request.camperId);
      if (!camper) throw new CamperNotFoundError();

      const decision = rule({
        session: { sessionId: session.id, className: cls.name, startsAt: session.startsAt, endsAt: session.endsAt, capacity: session.capacity, ageRange: cls.ageRange },
        seatsTaken: this.countWhere(session.id, 'enrolled'),
        camperDateOfBirth: camper.dateOfBirth,
        camperActive: this.activeFor(actor.orgId, camper.id),
      });
      if (decision.kind === 'refuse') throw refusalError(decision);

      const row: StoredEnrolment = {
        id: randomUUID(), orgId: actor.orgId, sessionId: session.id, camperId: camper.id, status: decision.status,
        enrolledAt: this.now().toISOString(), overrideReason: decision.overrode?.reason ?? null,
      };
      this.enrolments.set(row.id, row);
      this.record(actor, 'enrolment.create', 'enrolment', row.id, { sessionId: session.id, camperId: camper.id, status: decision.status });
      if (decision.overrode) {
        this.record(actor, 'enrolment.override', 'enrolment', row.id, {
          sessionId: session.id, camperId: camper.id, reason: decision.overrode.reason, clashSessionId: decision.overrode.clash.sessionId,
        });
      }
      return this.toEnrolment(row);
    });
  }

  async cancelEnrolment(actor: Actor, enrolmentId: string, note: string | null): Promise<Enrolment> {
    const existing = this.enrolments.get(enrolmentId);
    if (!existing || existing.orgId !== actor.orgId || existing.status === 'cancelled') throw new EnrolmentNotFoundError();
    return this.exclusive(existing.sessionId, async () => {
      const row = this.enrolments.get(enrolmentId);
      if (!row || row.orgId !== actor.orgId || row.status === 'cancelled') throw new EnrolmentNotFoundError();
      row.status = 'cancelled';
      this.record(actor, 'enrolment.cancel', 'enrolment', row.id, { sessionId: row.sessionId, camperId: row.camperId, note });
      return this.toEnrolment(row);
    });
  }

  private async exclusive<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    const run = previous.then(work);
    this.locks.set(key, run.then(() => undefined, () => undefined));
    return run;
  }

  private record(actor: Actor, action: AuditAction, entity: string, entityId: string, data: Record<string, unknown>): void {
    this.audit.push({ orgId: actor.orgId, actorId: actor.userId, action, entity, entityId, data });
  }

  private classIn(orgId: string, id: string): StoredClass | undefined {
    const c = this.classes.get(id);
    return c && c.orgId === orgId ? c : undefined;
  }

  private sessionIn(orgId: string, id: string): StoredSession | undefined {
    const s = this.sessions.get(id);
    return s && s.orgId === orgId ? s : undefined;
  }

  private camperIn(orgId: string, id: string): StoredCamper | undefined {
    const c = this.campers.get(id);
    return c && c.orgId === orgId ? c : undefined;
  }

  private countWhere(sessionId: string, status: EnrolmentStatus): number {
    return [...this.enrolments.values()].filter(e => e.sessionId === sessionId && e.status === status).length;
  }

  /** The camper's enrolled and waitlisted sessions in the camp. Cancelled ones free their time. */
  private activeFor(orgId: string, camperId: string): ActiveEnrolmentFacts[] {
    const out: ActiveEnrolmentFacts[] = [];
    for (const e of this.enrolments.values()) {
      if (e.orgId !== orgId || e.camperId !== camperId || e.status === 'cancelled') continue;
      const s = this.sessions.get(e.sessionId);
      const c = s ? this.classes.get(s.classId) : undefined;
      if (s && c) out.push({ sessionId: s.id, className: c.name, startsAt: s.startsAt, endsAt: s.endsAt });
    }
    return out;
  }

  private toSession(s: StoredSession, cls: StoredClass): Session {
    return {
      id: s.id, classId: s.classId, className: cls.name, startsAt: s.startsAt, endsAt: s.endsAt, location: s.location,
      instructorIds: [...s.instructorIds], capacity: s.capacity,
      seatsTaken: this.countWhere(s.id, 'enrolled'), waitlisted: this.countWhere(s.id, 'waitlisted'),
    };
  }

  private toEnrolment(e: StoredEnrolment): Enrolment {
    const s = this.sessions.get(e.sessionId);
    const c = s ? this.classes.get(s.classId) : undefined;
    const camper = this.campers.get(e.camperId);
    return {
      id: e.id, sessionId: e.sessionId, classId: c?.id ?? '', className: c?.name ?? '', camperId: e.camperId,
      camperName: camper?.name ?? '', status: e.status, enrolledAt: e.enrolledAt, overrideReason: e.overrideReason,
    };
  }
}

const byCreated = (a: StoredClass, b: StoredClass): number => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

function toClass(c: StoredClass): Class {
  return { id: c.id, name: c.name, description: c.description, ageRange: { ...c.ageRange }, capacity: c.capacity, instructorRatio: c.instructorRatio && { ...c.instructorRatio }, createdAt: c.createdAt };
}

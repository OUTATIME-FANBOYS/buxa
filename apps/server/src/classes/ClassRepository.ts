import type { Actor, EnrolmentDecision, EnrolmentFacts } from '@buxa/domain';
import type { Class, Enrolment, NewSessionInput, Session, SessionPriceInput } from '@buxa/contracts';

export type { Class, Session, Enrolment } from '@buxa/contracts';

/** A class as stored: its time range, ages and camp size. `capacity` is always given (the form requires it). */
export interface ClassRecord {
  name: string;
  ageRange: { minAge: number; maxAge: number };
  capacity: number;
  startsAt: string;
  endsAt: string;
  location: string;
  instructorIds: string[];
}

export interface EnrolRequest {
  classId: string;
  camperId: string;
}

/** The facts the enrolment rule needs, gathered inside the transaction. The class day is added by the service (it needs the camp zone). */
export type GatheredEnrolmentFacts = Omit<EnrolmentFacts, 'sessionDay'>;

/**
 * The decision callback. The repository calls it inside the transaction, after taking the class's lock, so the facts it sees
 * are the ones the write is based on. It must be pure: the service passes the domain rule, nothing else.
 */
export type EnrolmentRule = (facts: GatheredEnrolmentFacts) => EnrolmentDecision;

/**
 * Storage for sessions, classes and enrolments. Callers decide whether something may happen (permissions, rules in @buxa/domain);
 * implementations persist it and write the audit entry in the same transaction. Every method is scoped to the actor's organisation.
 * Refusals are thrown as the errors in ./errors.ts, after the transaction is rolled back, so nothing is written for a refused change.
 */
export interface ClassRepository {
  listSessions(orgId: string): Promise<Session[]>;
  getSession(orgId: string, sessionId: string): Promise<Session | null>;
  /** Audits `session.create`, and `session.price_change` when the session is created with a price. */
  createSession(actor: Actor, input: NewSessionInput): Promise<Session>;
  /** Sets or clears a session's price. Audits `session.price_change` with the old and new price. Throws SessionNotFoundError. */
  setSessionPrice(actor: Actor, sessionId: string, price: SessionPriceInput | null): Promise<Session>;
  /** Throws SessionNotFoundError. */
  listClasses(orgId: string, sessionId: string): Promise<Class[]>;
  getClass(orgId: string, classId: string): Promise<Class | null>;
  /** Audits `class.create`. Throws SessionNotFoundError, or InstructorNotFoundError for an instructor outside the camp. */
  addClass(actor: Actor, sessionId: string, input: ClassRecord): Promise<Class>;
  /**
   * Audits `class.update`. Throws ClassNotFoundError, InstructorNotFoundError, or CapacityBelowEnrolledError when the camp size
   * is below the places already taken.
   */
  updateClass(actor: Actor, classId: string, input: ClassRecord): Promise<Class>;
  /** Audits `class.delete`. Throws ClassNotFoundError, or ClassHasEnrolmentsError when any enrolment exists. */
  deleteClass(actor: Actor, classId: string): Promise<void>;
  /** Throws SessionNotFoundError. */
  listEnrolments(orgId: string, classId: string): Promise<Enrolment[]>;
  /**
   * The only place that checks and takes a seat. In one transaction, under a lock on the class: gathers the facts, runs `rule`,
   * and on `allow` writes the enrolment and its audit entries (`enrolment.create`, plus `enrolment.override` when an overlap was overridden).
   * On `refuse` it throws the matching error from ./errors.ts and writes nothing. Throws ClassNotFoundError, CamperNotFoundError.
   */
  enrol(actor: Actor, request: EnrolRequest, rule: EnrolmentRule): Promise<Enrolment>;
  /** Frees the seat and the time. Audits `enrolment.cancel`. Throws EnrolmentNotFoundError (also when already cancelled). */
  cancelEnrolment(actor: Actor, enrolmentId: string, note: string | null): Promise<Enrolment>;
  /**
   * The classes a teacher is assigned to in this camp. Only members with the teacher role count, so a person who stopped being a
   * teacher has no classes even before their assignments are cleared. Used by the assigned-classes scope (teacherScope.ts).
   */
  assignedClassIds(orgId: string, userId: string): Promise<string[]>;
  /** The people with an enrolled (not waitlisted or cancelled) place in any of the classes. */
  camperIdsIn(orgId: string, classIds: readonly string[]): Promise<string[]>;
  /**
   * Replaces a class's teachers (staff and admins, classes:manage). Audits `class.update`. Throws ClassNotFoundError, or
   * TeacherNotFoundError for a user who is not a teacher in this camp.
   */
  replaceTeachers(actor: Actor, classId: string, userIds: readonly string[]): Promise<void>;
}

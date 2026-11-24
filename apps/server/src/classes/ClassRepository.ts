import type { Actor, EnrolmentDecision, EnrolmentFacts } from '@buxa/domain';
import type { Class, Enrolment, NewSessionInput, Session, SessionEditInput, ClassPriceInput } from '@buxa/contracts';

export type { Class, Session, Enrolment } from '@buxa/contracts';

/**
 * A class as stored: its time range, ages, camp size and its own price (null when none is set). `capacity` is always given (the
 * form requires it).
 */
export interface ClassRecord {
  name: string;
  ageRange: { minAge: number; maxAge: number };
  capacity: number;
  startsAt: string;
  endsAt: string;
  location: string;
  instructorIds: string[];
  price: ClassPriceInput | null;
}

/** A class's times and name, for every class in the camp: what a new class must not clash with. */
export interface CampClassSpan {
  startsAt: string;
  endsAt: string;
  className: string;
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
  listSessions(userId: string, orgId: string): Promise<Session[]>;
  getSession(userId: string, orgId: string, sessionId: string): Promise<Session | null>;
  /** Audits `session.create`. */
  createSession(actor: Actor, input: NewSessionInput): Promise<Session>;
  /**
   * Saves a session's name, description, dates and public flag. Audits `session.update` with the old and new values,
   * and writes nothing when no value changed. Throws SessionNotFoundError.
   */
  updateSession(actor: Actor, sessionId: string, input: SessionEditInput): Promise<Session>;
  /** Audits `session.delete`. Throws SessionNotFoundError, or SessionHasClassesError when the session holds any class. */
  deleteSession(actor: Actor, sessionId: string): Promise<void>;
  /**
   * Deletes a session's classes and then the session, in one transaction, for an admin or the owner. Audits `class.delete` for each
   * class and `session.delete`. Throws SessionNotFoundError, or SessionHasEnrolmentsError when any class has an enrolment, hold,
   * registration, check-in or season pass.
   */
  deleteSessionWithClasses(actor: Actor, sessionId: string): Promise<void>;
  /** Archives (`archived` true) or unarchives a session. Audits `session.archive` or `session.unarchive`. Throws SessionNotFoundError. */
  setSessionArchived(actor: Actor, sessionId: string, archived: boolean): Promise<Session>;
  /** The name of another session in the camp with the same name in the normalised form (see sessionNameKey), or null. `exceptId` is the session being edited. */
  sessionNameTaken(userId: string, orgId: string, name: string, exceptId: string | null): Promise<string | null>;
  /** Audits `session.update`. Throws SessionNotFoundError. */
  setSessionPublic(actor: Actor, sessionId: string, isPublic: boolean): Promise<Session>;
  /**
   * Writes every class of a series in one transaction, or none. Audits `class.create` for each. Throws SessionNotFoundError,
   * or InstructorNotFoundError.
   */
  addClasses(actor: Actor, sessionId: string, inputs: ClassRecord[]): Promise<Class[]>;
  /** Times and names of every class in the camp, for the clash check. */
  listCampClassSpans(userId: string, orgId: string): Promise<CampClassSpan[]>;
  /** Throws SessionNotFoundError. */
  listClasses(userId: string, orgId: string, sessionId: string): Promise<Class[]>;
  getClass(userId: string, orgId: string, classId: string): Promise<Class | null>;
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
  listEnrolments(userId: string, orgId: string, classId: string): Promise<Enrolment[]>;
  /**
   * The only place that checks and takes a seat. In one transaction, under a lock on the class: gathers the facts, runs `rule`,
   * and on `allow` writes the enrolment and its audit entries (`enrolment.create`, plus `enrolment.override` when an overlap was overridden).
   * On `refuse` it throws the matching error from ./errors.ts and writes nothing. Throws ClassNotFoundError, CamperNotFoundError.
   */
  enrol(actor: Actor, request: EnrolRequest, rule: EnrolmentRule): Promise<Enrolment>;
  /** Frees the seat and the time. Audits `enrolment.cancel`. Throws EnrolmentNotFoundError (also when already cancelled). */
  cancelEnrolment(actor: Actor, enrolmentId: string, note: string | null): Promise<Enrolment>;
  /**
   * The classes a teacher is assigned to in this camp: the classes whose instructors include the person linked to the teacher's
   * login (people.user_id). Only members with the teacher role count. A teacher with no linked person has no classes. Used by the
   * assigned-classes scope (teacherScope.ts).
   */
  assignedClassIds(userId: string, orgId: string, teacherId: string): Promise<string[]>;
  /** The people with an enrolled (not waitlisted or cancelled) place in any of the classes. */
  camperIdsIn(userId: string, orgId: string, classIds: readonly string[]): Promise<string[]>;
  /**
   * Every seat hold in the camp that holds a place now (unreleased and not yet expired), in one read, ordered by expiry. Read only.
   * Callers check the permission (SeatHoldService.listCampActiveHolds).
   */
  listCampActiveHolds(userId: string, orgId: string): Promise<CampActiveHold[]>;
  /**
   * Every waitlisted camper in the camp, grouped by class in the order the classes start, and in the order each camper joined
   * within a class. Read only; callers check the permission (ClassService.listCampWaitlists).
   */
  listCampWaitlists(userId: string, orgId: string): Promise<CampWaitlistEntry[]>;
}

/**
 * A seat hold that holds a place right now, in any class of the camp, for the camp-wide holds screen. `childName` is the child the
 * hold was taken for (from the registration), or null for a hold without one.
 */
export interface CampActiveHold {
  id: string;
  sessionId: string;
  sessionName: string;
  classId: string;
  className: string;
  householdId: string;
  householdName: string;
  childName: string | null;
  createdAt: string;
  expiresAt: string;
}

/** A camper waiting for a place in a class, with the family name they joined under (null when the camper has no household). */
export interface CampWaitlistEntry {
  enrolmentId: string;
  sessionId: string;
  sessionName: string;
  classId: string;
  className: string;
  householdName: string | null;
  camperName: string;
  joinedAt: string;
}

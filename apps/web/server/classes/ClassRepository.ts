import type { Actor, EnrolmentDecision, EnrolmentFacts } from '@buxa/domain';
import type { Class, Enrolment, NewClassInput, Session } from '@buxa/contracts';

export type { Class, Session, Enrolment } from '@buxa/contracts';

/** A session as stored; `capacity` is already resolved (the class default when the input left it out). */
export interface NewSessionRecord {
  startsAt: string;
  endsAt: string;
  location: string;
  instructorIds: string[];
  capacity: number;
}

export interface EnrolRequest {
  sessionId: string;
  camperId: string;
}

/** The facts the enrolment rule needs, gathered inside the transaction. The session day is added by the service (it needs the camp zone). */
export type GatheredEnrolmentFacts = Omit<EnrolmentFacts, 'sessionDay'>;

/**
 * The decision callback. The repository calls it inside the transaction, after taking the session's lock, so the facts it sees
 * are the ones the write is based on. It must be pure: the service passes the domain rule, nothing else.
 */
export type EnrolmentRule = (facts: GatheredEnrolmentFacts) => EnrolmentDecision;

/**
 * Storage for classes, sessions and enrolments. Callers decide whether something may happen (permissions, rules in @buxa/domain);
 * implementations persist it and write the audit entry in the same transaction. Every method is scoped to the actor's organisation.
 * Refusals are thrown as the errors in ./errors.ts, after the transaction is rolled back, so nothing is written for a refused enrolment.
 */
export interface ClassRepository {
  listClasses(orgId: string): Promise<Class[]>;
  getClass(orgId: string, classId: string): Promise<Class | null>;
  /** Audits `class.create`. */
  createClass(actor: Actor, input: NewClassInput): Promise<Class>;
  /** Audits `session.create`. Throws ClassNotFoundError. */
  addSession(actor: Actor, classId: string, input: NewSessionRecord): Promise<Session>;
  /** Throws ClassNotFoundError. */
  listSessions(orgId: string, classId: string): Promise<Session[]>;
  /** Throws SessionNotFoundError. */
  listEnrolments(orgId: string, sessionId: string): Promise<Enrolment[]>;
  /**
   * The only place that checks and takes a seat. In one transaction, under a lock on the session: gathers the facts, runs `rule`,
   * and on `allow` writes the enrolment and its audit entries (`enrolment.create`, plus `enrolment.override` when an overlap was overridden).
   * On `refuse` it throws the matching error from ./errors.ts and writes nothing. Throws SessionNotFoundError, CamperNotFoundError.
   */
  enrol(actor: Actor, request: EnrolRequest, rule: EnrolmentRule): Promise<Enrolment>;
  /** Frees the seat and the time. Audits `enrolment.cancel`. Throws EnrolmentNotFoundError (also when already cancelled). */
  cancelEnrolment(actor: Actor, enrolmentId: string, note: string | null): Promise<Enrolment>;
}

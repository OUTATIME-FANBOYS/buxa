import { isUuid, MAX_AGE_LIMIT, type ActiveEnrolmentFacts } from '@buxa/domain';
import type { Class, Enrolment, EnrolmentStatus, Session } from '@buxa/contracts';
import { toIso, type Db } from '../people/pgRows';
import { ClassNotFoundError, EnrolmentNotFoundError, SessionNotFoundError } from './errors';

/*
 * Reads for classes, sessions and enrolments, and the row-to-record mapping. Every query runs inside withOrg, so row-level
 * security decides what is visible; the org is never in the SQL. Instants are formatted as ISO strings by the mappers.
 */

export interface ClassRow {
  id: string;
  name: string;
  description: string | null;
  age_min: number | null;
  age_max: number | null;
  default_capacity: number;
  ratio_campers: number | null;
  ratio_instructors: number | null;
  created_at: Date;
}

export interface SessionRow {
  id: string;
  class_id: string;
  class_name: string;
  starts_at: Date;
  ends_at: Date;
  location: string;
  capacity: number;
  seats_taken: number;
  waitlisted: number;
  /** Each instructor's person id and display name, as json from the same statement. */
  instructors: { id: string; name: string }[];
}

export interface EnrolmentRow {
  id: string;
  session_id: string;
  class_id: string;
  class_name: string;
  camper_id: string;
  camper_name: string;
  status: EnrolmentStatus;
  created_at: Date;
  override_reason: string | null;
}

/** A class with no age bound is stored as NULL. The contract always carries numbers, so the open ends are filled in on read. */
export const toAgeRange = (min: number | null, max: number | null): { minAge: number; maxAge: number } => ({
  minAge: min ?? 0,
  maxAge: max ?? MAX_AGE_LIMIT,
});

export function toClass(row: ClassRow): Class {
  const ratio = row.ratio_campers !== null && row.ratio_instructors !== null
    ? { instructors: row.ratio_instructors, campers: row.ratio_campers }
    : null;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    ageRange: toAgeRange(row.age_min, row.age_max),
    capacity: row.default_capacity,
    instructorRatio: ratio,
    createdAt: toIso(row.created_at),
  };
}

export function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class_name,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    location: row.location,
    instructorIds: row.instructors.map(i => i.id),
    instructors: row.instructors.map(i => ({ id: i.id, name: i.name })),
    capacity: row.capacity,
    seatsTaken: row.seats_taken,
    waitlisted: row.waitlisted,
  };
}

export function toEnrolment(row: EnrolmentRow): Enrolment {
  return {
    id: row.id,
    sessionId: row.session_id,
    classId: row.class_id,
    className: row.class_name,
    camperId: row.camper_id,
    camperName: row.camper_name,
    status: row.status,
    enrolledAt: toIso(row.created_at),
    overrideReason: row.override_reason,
  };
}

/** The camper's enrolled or waitlisted sessions, as the overlap rule sees them. Cancelled ones free their time. */
export function toActiveFacts(row: { session_id: string; class_name: string; starts_at: Date; ends_at: Date }): ActiveEnrolmentFacts {
  return { sessionId: row.session_id, className: row.class_name, startsAt: toIso(row.starts_at), endsAt: toIso(row.ends_at) };
}

const CLASS_COLUMNS = `c.id, c.name, c.description, c.age_min, c.age_max, c.default_capacity,
  c.ratio_campers, c.ratio_instructors, c.created_at`;

/** Seats and instructors are counted in the same statement, so a session read is one consistent snapshot. */
const SESSION_COLUMNS = `s.id, s.class_id, c.name AS class_name, s.starts_at, s.ends_at, s.location, s.capacity,
  (SELECT count(*)::int FROM enrolments e WHERE e.session_id = s.id AND e.status = 'enrolled') AS seats_taken,
  (SELECT count(*)::int FROM enrolments e WHERE e.session_id = s.id AND e.status = 'waitlisted') AS waitlisted,
  COALESCE((SELECT json_agg(json_build_object('id', p.id::text, 'name', trim(p.given_name || ' ' || p.family_name))
                             ORDER BY p.family_name, p.given_name, p.id)
              FROM session_instructors si JOIN people p ON p.id = si.person_id
             WHERE si.session_id = s.id), '[]'::json) AS instructors`;

const ENROLMENT_COLUMNS = `e.id, e.session_id, c.id AS class_id, c.name AS class_name, e.person_id AS camper_id,
  trim(p.given_name || ' ' || p.family_name) AS camper_name, e.status, e.created_at, e.override_reason`;

const ENROLMENT_FROM = `FROM enrolments e
  JOIN sessions s ON s.id = e.session_id
  JOIN classes c ON c.id = s.class_id
  JOIN people p ON p.id = e.person_id`;

export async function listClassRows(db: Db): Promise<Class[]> {
  const { rows } = await db.query<ClassRow>(`SELECT ${CLASS_COLUMNS} FROM classes c ORDER BY c.created_at, c.id`);

  return rows.map(toClass);
}

export async function getClass(db: Db, id: string): Promise<Class | null> {
  if (!isUuid(id)) {
    return null;
  }
  const { rows } = await db.query<ClassRow>(`SELECT ${CLASS_COLUMNS} FROM classes c WHERE c.id = $1`, [id]);

  return rows[0] ? toClass(rows[0]) : null;
}

export async function requireClass(db: Db, id: string): Promise<Class> {
  const found = await getClass(db, id);
  if (!found) {
    throw new ClassNotFoundError();
  }

  return found;
}

export async function getSession(db: Db, id: string): Promise<Session | null> {
  if (!isUuid(id)) {
    return null;
  }
  const { rows } = await db.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM sessions s JOIN classes c ON c.id = s.class_id WHERE s.id = $1`, [id]);

  return rows[0] ? toSession(rows[0]) : null;
}

export async function listSessionRows(db: Db, classId: string): Promise<Session[]> {
  const { rows } = await db.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM sessions s JOIN classes c ON c.id = s.class_id
      WHERE s.class_id = $1 ORDER BY s.starts_at, s.id`, [classId]);

  return rows.map(toSession);
}

export async function requireSessionExists(db: Db, id: string): Promise<void> {
  if (!isUuid(id)) {
    throw new SessionNotFoundError();
  }
  const { rows } = await db.query<{ id: string }>('SELECT id FROM sessions WHERE id = $1', [id]);
  if (rows.length === 0) {
    throw new SessionNotFoundError();
  }
}

export async function listEnrolmentRows(db: Db, sessionId: string): Promise<Enrolment[]> {
  const { rows } = await db.query<EnrolmentRow>(
    `SELECT ${ENROLMENT_COLUMNS} ${ENROLMENT_FROM} WHERE e.session_id = $1 ORDER BY e.created_at, e.id`, [sessionId]);

  return rows.map(toEnrolment);
}

export async function requireEnrolment(db: Db, id: string): Promise<Enrolment> {
  const { rows } = await db.query<EnrolmentRow>(`SELECT ${ENROLMENT_COLUMNS} ${ENROLMENT_FROM} WHERE e.id = $1`, [id]);
  if (!rows[0]) {
    throw new EnrolmentNotFoundError();
  }

  return toEnrolment(rows[0]);
}

/** The camper's enrolled and waitlisted sessions in the camp, read after the camper's row is locked. */
export async function activeFactsFor(db: Db, camperId: string): Promise<ActiveEnrolmentFacts[]> {
  const { rows } = await db.query<{ session_id: string; class_name: string; starts_at: Date; ends_at: Date }>(
    `SELECT e.session_id, c.name AS class_name, s.starts_at, s.ends_at
       FROM enrolments e
       JOIN sessions s ON s.id = e.session_id
       JOIN classes c ON c.id = s.class_id
      WHERE e.person_id = $1 AND e.status IN ('enrolled', 'waitlisted')
      ORDER BY s.starts_at, e.session_id`, [camperId]);

  return rows.map(toActiveFacts);
}

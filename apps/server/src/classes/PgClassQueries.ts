import { isUuid, MAX_AGE_LIMIT, type ActiveEnrolmentFacts } from '@buxa/domain';
import type { Class, Enrolment, EnrolmentStatus, Session, ClassPriceInput } from '@buxa/contracts';
import { toIso, type Db } from '../people/pgRows';
import { ClassNotFoundError, EnrolmentNotFoundError, SessionNotFoundError } from './errors';

/*
 * Reads for sessions, classes and enrolments, and the row-to-record mapping. Every query runs inside withOrg, so row-level
 * security decides what is visible; the org is never in the SQL. Instants are formatted as ISO strings by the mappers.
 *
 * Table names follow migration 0022, which kept them: the `classes` table holds the sessions (the parents), and the `sessions`
 * table holds the classes (the time-range rows). Enrolments point at the `sessions` table.
 */

/** A session (parent) row. Dates are text YYYY-MM-DD, or NULL when no class has been given a time yet. */
export interface SessionRow {
  id: string;
  name: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  class_count: number;
  is_public: boolean;
  archived_at: Date | null;
  created_at: Date;
}

/** The price columns of a class row (the `sessions` table; see CLASS_COLUMNS). All NULL when no price is set. */
export interface PriceRow {
  price_minor: number | null;
  price_currency: string | null;
  early_bird_minor: number | null;
  early_bird_until: string | null;
}

/** A session's stored price from its row, or null when it has none. */
export function toPrice(row: PriceRow): ClassPriceInput | null {
  if (row.price_minor === null || row.price_currency === null) {
    return null;
  }

  return {
    currency: row.price_currency,
    regularMinor: row.price_minor,
    earlyBirdMinor: row.early_bird_minor,
    earlyBirdUntil: row.early_bird_until,
  };
}

/** A class row: its own time range, ages and camp size, with its session's name and the seat counts from the same statement. */
export interface ClassRow {
  id: string;
  session_id: string;
  session_name: string;
  name: string;
  age_min: number | null;
  age_max: number | null;
  capacity: number;
  starts_at: Date;
  ends_at: Date;
  location: string;
  seats_taken: number;
  waitlisted: number;
  /** Each instructor's person id and display name, as json from the same statement. */
  instructors: { id: string; name: string }[];
  price_minor: number | null;
  price_currency: string | null;
  early_bird_minor: number | null;
  early_bird_until: string | null;
}

export interface EnrolmentRow {
  id: string;
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

export function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    classCount: row.class_count,
    isPublic: row.is_public,
    archivedAt: row.archived_at ? toIso(row.archived_at) : null,
    createdAt: toIso(row.created_at),
  };
}

export function toClass(row: ClassRow): Class {
  return {
    id: row.id,
    sessionId: row.session_id,
    sessionName: row.session_name,
    name: row.name,
    ageRange: toAgeRange(row.age_min, row.age_max),
    capacity: row.capacity,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    location: row.location,
    instructorIds: row.instructors.map(i => i.id),
    instructors: row.instructors.map(i => ({ id: i.id, name: i.name })),
    seatsTaken: row.seats_taken,
    waitlisted: row.waitlisted,
    price: toPrice(row),
  };
}

export function toEnrolment(row: EnrolmentRow): Enrolment {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class_name,
    camperId: row.camper_id,
    camperName: row.camper_name,
    status: row.status,
    enrolledAt: toIso(row.created_at),
    overrideReason: row.override_reason,
  };
}

/** The camper's enrolled or waitlisted classes, as the overlap rule sees them. Cancelled ones free their time. */
export function toActiveFacts(row: {
  class_id: string;
  class_name: string;
  starts_at: Date;
  ends_at: Date;
}): ActiveEnrolmentFacts {
  return {
    sessionId: row.class_id,
    className: row.class_name,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
  };
}

const SESSION_COLUMNS = `p.id, p.name, p.description, to_char(p.starts_on, 'YYYY-MM-DD') AS starts_on,
  to_char(p.ends_on, 'YYYY-MM-DD') AS ends_on, p.is_public, p.archived_at, p.created_at,
  (SELECT count(*)::int FROM sessions s WHERE s.class_id = p.id) AS class_count`;

/** Seats and instructors are counted in the same statement, so a class read is one consistent snapshot. */
const CLASS_COLUMNS = `s.id, s.class_id AS session_id, p.name AS session_name, s.name, s.age_min, s.age_max, s.capacity,
  s.starts_at, s.ends_at, s.location,
  s.price_minor, s.price_currency, s.early_bird_minor, to_char(s.early_bird_until, 'YYYY-MM-DD') AS early_bird_until,
  session_seats_taken(s.id) AS seats_taken,
  (SELECT count(*)::int FROM enrolments e WHERE e.session_id = s.id AND e.status = 'waitlisted') AS waitlisted,
  COALESCE((SELECT json_agg(json_build_object('id', i.id::text, 'name', trim(i.given_name || ' ' || i.family_name))
                             ORDER BY i.family_name, i.given_name, i.id)
              FROM session_instructors si JOIN people i ON i.id = si.person_id
             WHERE si.session_id = s.id), '[]'::json) AS instructors`;

const ENROLMENT_COLUMNS = `e.id, e.session_id AS class_id, s.name AS class_name, e.person_id AS camper_id,
  trim(p.given_name || ' ' || p.family_name) AS camper_name, e.status, e.created_at, e.override_reason`;

const ENROLMENT_FROM = `FROM enrolments e
  JOIN sessions s ON s.id = e.session_id
  JOIN people p ON p.id = e.person_id`;

const CLASS_FROM = 'FROM sessions s JOIN classes p ON p.id = s.class_id';

export async function listSessionRows(db: Db): Promise<Session[]> {
  const { rows } = await db.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM classes p ORDER BY p.starts_on NULLS LAST, p.created_at, p.id`,
  );

  return rows.map(toSession);
}

export async function getSession(db: Db, id: string): Promise<Session | null> {
  if (!isUuid(id)) {
    return null;
  }
  const { rows } = await db.query<SessionRow>(`SELECT ${SESSION_COLUMNS} FROM classes p WHERE p.id = $1`, [id]);

  return rows[0] ? toSession(rows[0]) : null;
}

export async function requireSession(db: Db, id: string): Promise<Session> {
  const found = await getSession(db, id);
  if (!found) {
    throw new SessionNotFoundError();
  }

  return found;
}

export async function getClass(db: Db, id: string): Promise<Class | null> {
  if (!isUuid(id)) {
    return null;
  }
  const { rows } = await db.query<ClassRow>(`SELECT ${CLASS_COLUMNS} ${CLASS_FROM} WHERE s.id = $1`, [id]);

  return rows[0] ? toClass(rows[0]) : null;
}

export async function requireClass(db: Db, id: string): Promise<Class> {
  const found = await getClass(db, id);
  if (!found) {
    throw new ClassNotFoundError();
  }

  return found;
}

export async function listClassRows(db: Db, sessionId: string): Promise<Class[]> {
  const { rows } = await db.query<ClassRow>(
    `SELECT ${CLASS_COLUMNS} ${CLASS_FROM} WHERE s.class_id = $1 ORDER BY s.starts_at, s.id`,
    [sessionId],
  );

  return rows.map(toClass);
}

export async function requireSessionExists(db: Db, id: string): Promise<void> {
  if (!isUuid(id)) {
    throw new SessionNotFoundError();
  }
  const { rows } = await db.query<{ id: string }>('SELECT id FROM classes WHERE id = $1', [id]);
  if (rows.length === 0) {
    throw new SessionNotFoundError();
  }
}

export async function requireClassExists(db: Db, id: string): Promise<void> {
  if (!isUuid(id)) {
    throw new ClassNotFoundError();
  }
  const { rows } = await db.query<{ id: string }>('SELECT id FROM sessions WHERE id = $1', [id]);
  if (rows.length === 0) {
    throw new ClassNotFoundError();
  }
}

export async function listEnrolmentRows(db: Db, classId: string): Promise<Enrolment[]> {
  const { rows } = await db.query<EnrolmentRow>(
    `SELECT ${ENROLMENT_COLUMNS} ${ENROLMENT_FROM} WHERE e.session_id = $1 ORDER BY e.created_at, e.id`,
    [classId],
  );

  return rows.map(toEnrolment);
}

export async function requireEnrolment(db: Db, id: string): Promise<Enrolment> {
  const { rows } = await db.query<EnrolmentRow>(`SELECT ${ENROLMENT_COLUMNS} ${ENROLMENT_FROM} WHERE e.id = $1`, [id]);
  if (!rows[0]) {
    throw new EnrolmentNotFoundError();
  }

  return toEnrolment(rows[0]);
}

/** The camper's enrolled and waitlisted classes in the camp, read after the camper's row is locked. */
export async function activeFactsFor(db: Db, camperId: string): Promise<ActiveEnrolmentFacts[]> {
  const { rows } = await db.query<{ class_id: string; class_name: string; starts_at: Date; ends_at: Date }>(
    `SELECT e.session_id AS class_id, s.name AS class_name, s.starts_at, s.ends_at
       FROM enrolments e
       JOIN sessions s ON s.id = e.session_id
      WHERE e.person_id = $1 AND e.status IN ('enrolled', 'waitlisted')
      ORDER BY s.starts_at, e.session_id`,
    [camperId],
  );

  return rows.map(toActiveFacts);
}

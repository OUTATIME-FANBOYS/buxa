import { isUuid, type Actor } from '@buxa/domain';
import type { NewSessionInput, SessionPriceInput } from '@buxa/contracts';
import { recordAudit } from '../audit/recordAudit';
import { type Db } from '../people/pgRows';
import type { ClassRecord } from './ClassRepository';
import { ClassNotFoundError, InstructorNotFoundError, SessionNotFoundError } from './errors';
import { toPrice, type PriceRow } from './PgClassQueries';
import { priceChangeAudit, samePrice } from './priceAudit';

/*
 * Writes for sessions (the parent rows) and classes (the time-range rows). Each write audits itself in the same transaction.
 * Table names follow migration 0022: a session is a row of `classes`, a class is a row of `sessions`.
 */

/** Inserts a session (a date range that holds classes, and an optional price) and audits it. Returns its id. */
export async function insertSession(db: Db, actor: Actor, input: NewSessionInput): Promise<string> {
  const price = input.price ?? null;
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO classes (org_id, name, description, starts_on, ends_on, price_minor, price_currency, early_bird_minor, early_bird_until)
     VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9::date) RETURNING id`,
    [
      actor.orgId,
      input.name,
      input.description,
      input.startsOn,
      input.endsOn,
      price?.regularMinor ?? null,
      price?.currency ?? null,
      price?.earlyBirdMinor ?? null,
      price?.earlyBirdUntil ?? null,
    ],
  );
  const id = rows[0].id;
  await recordAudit(db, {
    actor,
    action: 'session.create',
    entity: 'session',
    entityId: id,
    data: { name: input.name },
  });
  if (price) {
    await recordAudit(db, {
      actor,
      action: 'session.price_change',
      entity: 'session',
      entityId: id,
      data: priceChangeAudit(null, price),
    });
  }

  return id;
}

/**
 * Sets or clears a session's price. Locks the session row first, so the audit entry records the price that was really replaced.
 * An unchanged price writes nothing. Throws SessionNotFoundError when the session is not in the camp.
 */
export async function setSessionPriceRow(
  db: Db,
  actor: Actor,
  sessionId: string,
  price: SessionPriceInput | null,
): Promise<void> {
  const { rows } = await db.query<PriceRow & { id: string }>(
    `SELECT id, price_minor, price_currency, early_bird_minor, to_char(early_bird_until, 'YYYY-MM-DD') AS early_bird_until
       FROM classes WHERE id = $1 AND org_id = $2 FOR UPDATE`,
    [sessionId, actor.orgId],
  );
  if (rows.length === 0) {
    throw new SessionNotFoundError();
  }
  const before = toPrice(rows[0]);
  if (samePrice(before, price)) {
    return;
  }
  await db.query(
    `UPDATE classes
        SET price_minor = $3, price_currency = $4, early_bird_minor = $5, early_bird_until = $6::date
      WHERE id = $1 AND org_id = $2`,
    [
      sessionId,
      actor.orgId,
      price?.regularMinor ?? null,
      price?.currency ?? null,
      price?.earlyBirdMinor ?? null,
      price?.earlyBirdUntil ?? null,
    ],
  );
  await recordAudit(db, {
    actor,
    action: 'session.price_change',
    entity: 'session',
    entityId: sessionId,
    data: priceChangeAudit(before, price),
  });
}

/**
 * Every instructor must be a person in this camp. Row-level security makes another camp's people invisible, so a foreign id
 * is simply missing from the result.
 */
export async function requireInstructors(db: Db, instructorIds: readonly string[]): Promise<string[]> {
  const unique = [...new Set(instructorIds)];
  if (unique.length === 0) {
    return unique;
  }
  if (!unique.every(isUuid)) {
    throw new InstructorNotFoundError();
  }
  const { rows } = await db.query<{ id: string }>('SELECT id FROM people WHERE id = ANY($1::uuid[])', [unique]);
  if (rows.length !== unique.length) {
    throw new InstructorNotFoundError();
  }

  return unique;
}

/**
 * Inserts a class under a session and links its instructors. The name and ages are given here; the session's date range is
 * widened by the database trigger (migration 0022) so it covers the class. The session must exist in the camp.
 */
export async function insertClass(db: Db, actor: Actor, sessionId: string, input: ClassRecord): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessions (org_id, class_id, name, age_min, age_max, starts_at, ends_at, location, capacity)
     SELECT $1, p.id, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9
       FROM classes p WHERE p.id = $2
     RETURNING id`,
    [
      actor.orgId,
      sessionId,
      input.name,
      input.ageRange.minAge,
      input.ageRange.maxAge,
      input.startsAt,
      input.endsAt,
      input.location,
      input.capacity,
    ],
  );
  if (rows.length === 0) {
    throw new SessionNotFoundError();
  }
  const id = rows[0].id;
  const instructors = await requireInstructors(db, input.instructorIds);
  if (instructors.length > 0) {
    await db.query(
      'INSERT INTO session_instructors (org_id, session_id, person_id) SELECT $1, $2, unnest($3::uuid[])',
      [actor.orgId, id, instructors],
    );
  }
  // The audit keeps the instructors' ids (the people's names are not copied into the log), so a later read can show who was linked.
  await recordAudit(db, {
    actor,
    action: 'class.create',
    entity: 'class',
    entityId: id,
    data: { sessionId, startsAt: input.startsAt, endsAt: input.endsAt, instructorIds: instructors },
  });

  return id;
}

/**
 * Updates a class's own fields and replaces its instructors. The camp-size floor is a trigger (migration 0008) and the function
 * that replaces instructors is in migration 0022. Throws ClassNotFoundError when the class is not in the camp.
 */
export async function updateClassRow(db: Db, actor: Actor, classId: string, input: ClassRecord): Promise<void> {
  const { rows } = await db.query<{ id: string }>(
    `UPDATE sessions
        SET name = $3, age_min = $4, age_max = $5, starts_at = $6::timestamptz, ends_at = $7::timestamptz,
            location = $8, capacity = $9
      WHERE id = $1 AND org_id = $2
      RETURNING id`,
    [
      classId,
      actor.orgId,
      input.name,
      input.ageRange.minAge,
      input.ageRange.maxAge,
      input.startsAt,
      input.endsAt,
      input.location,
      input.capacity,
    ],
  );
  if (rows.length === 0) {
    throw new ClassNotFoundError();
  }
  const instructors = await requireInstructors(db, input.instructorIds);
  await db.query('SELECT buxa_replace_class_instructors($1, $2, $3::uuid[])', [actor.orgId, classId, instructors]);
  await recordAudit(db, {
    actor,
    action: 'class.update',
    entity: 'class',
    entityId: classId,
    data: { startsAt: input.startsAt, endsAt: input.endsAt, capacity: input.capacity, instructorIds: instructors },
  });
}

/** Deletes a class through buxa_delete_class (migration 0022), which refuses a class with enrolments. Audits `class.delete`. */
export async function deleteClassRow(db: Db, actor: Actor, classId: string, name: string): Promise<void> {
  await db.query('SELECT buxa_delete_class($1, $2)', [actor.orgId, classId]);
  await recordAudit(db, { actor, action: 'class.delete', entity: 'class', entityId: classId, data: { name } });
}

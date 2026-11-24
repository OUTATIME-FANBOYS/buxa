import { isUuid, type Actor } from '@buxa/domain';
import type { NewSessionInput, SessionEditInput } from '@buxa/contracts';
import { recordAudit } from '../audit/recordAudit';
import { type Db } from '../people/pgRows';
import type { ClassRecord } from './ClassRepository';
import { ClassNotFoundError, InstructorNotFoundError, SessionNotFoundError } from './errors';
import { toPrice, type PriceRow } from './PgClassQueries';
import { priceChangeAudit, samePrice } from './priceAudit';
import { sameSessionDetails, sessionEditAudit, type SessionDetails } from './sessionEditAudit';

/*
 * Writes for sessions (the parent rows) and classes (the time-range rows). Each write audits itself in the same transaction.
 * Table names follow migration 0022: a session is a row of `classes`, a class is a row of `sessions`.
 */

/** Inserts a session (a date range that holds classes) and audits it. Returns its id. A session has no price; its classes do. */
export async function insertSession(db: Db, actor: Actor, input: NewSessionInput): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO classes (org_id, name, description, starts_on, ends_on, is_public)
     VALUES ($1, $2, $3, $4::date, $5::date, $6) RETURNING id`,
    [actor.orgId, input.name, input.description, input.startsOn, input.endsOn, input.isPublic ?? false],
  );
  const id = rows[0].id;
  await recordAudit(db, {
    actor,
    action: 'session.create',
    entity: 'session',
    entityId: id,
    data: { name: input.name },
  });

  return id;
}

/**
 * Saves a session's details (not its price). Locks the row first, so the audit entry records the values that were really replaced.
 * Nothing is written when no value changed. Throws SessionNotFoundError when the session is not in the camp.
 */
export async function updateSessionRow(
  db: Db,
  actor: Actor,
  sessionId: string,
  input: SessionEditInput,
): Promise<void> {
  const { rows } = await db.query<{
    name: string;
    description: string | null;
    starts_on: string | null;
    ends_on: string | null;
    is_public: boolean;
  }>(
    `SELECT name, description, to_char(starts_on, 'YYYY-MM-DD') AS starts_on, to_char(ends_on, 'YYYY-MM-DD') AS ends_on, is_public
       FROM classes WHERE id = $1 AND org_id = $2 FOR UPDATE`,
    [sessionId, actor.orgId],
  );
  if (rows.length === 0) {
    throw new SessionNotFoundError();
  }
  const before: SessionDetails = {
    name: rows[0].name,
    description: rows[0].description ?? '',
    startsOn: rows[0].starts_on,
    endsOn: rows[0].ends_on,
    isPublic: rows[0].is_public,
  };
  const after: SessionDetails = {
    name: input.name,
    description: input.description,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    isPublic: input.isPublic ?? false,
  };
  if (sameSessionDetails(before, after)) {
    return;
  }
  await db.query(
    `UPDATE classes
        SET name = $3, description = $4, starts_on = $5::date, ends_on = $6::date, is_public = $7
      WHERE id = $1 AND org_id = $2`,
    [sessionId, actor.orgId, after.name, after.description, after.startsOn, after.endsOn, after.isPublic],
  );
  await recordAudit(db, {
    actor,
    action: 'session.update',
    entity: 'session',
    entityId: sessionId,
    data: sessionEditAudit(before, after),
  });
}

/**
 * Deletes a session through buxa_delete_session_v2 (migration 0035). The database refuses a session that holds classes; the app
 * checks classes:manage with authorize() before it calls this. Audits `session.delete`.
 */
export async function deleteSessionRow(db: Db, actor: Actor, sessionId: string, name: string): Promise<void> {
  await db.query('SELECT buxa_delete_session_v2($1, $2)', [actor.orgId, sessionId]);
  await recordAudit(db, { actor, action: 'session.delete', entity: 'session', entityId: sessionId, data: { name } });
}

/**
 * Deletes a session's classes (rows of `sessions`) and then the session, through buxa_delete_session_with_classes_v1 (migration 0052).
 * The function refuses a session whose classes hold enrolments, holds, registrations, check-ins or season passes, and deletes nothing
 * then. Audits `class.delete` for each class and `session.delete` for the session, in the same transaction.
 */
export async function deleteSessionWithClassesRow(
  db: Db,
  actor: Actor,
  sessionId: string,
  name: string,
): Promise<void> {
  const { rows } = await db.query<{ deleted_class_id: string; deleted_class_name: string }>(
    'SELECT deleted_class_id, deleted_class_name FROM buxa_delete_session_with_classes_v1($1, $2)',
    [actor.orgId, sessionId],
  );
  for (const row of rows) {
    await recordAudit(db, {
      actor,
      action: 'class.delete',
      entity: 'class',
      entityId: row.deleted_class_id,
      data: { name: row.deleted_class_name, session: name },
    });
  }
  await recordAudit(db, {
    actor,
    action: 'session.delete',
    entity: 'session',
    entityId: sessionId,
    data: { name, classes: rows.length },
  });
}

/** Archives or unarchives a session, and audits it. Throws SessionNotFoundError when the session is not in the camp. */
export async function setSessionArchivedRow(db: Db, actor: Actor, sessionId: string, archived: boolean): Promise<void> {
  const { rows } = await db.query<{ id: string }>(
    `UPDATE classes
        SET archived_at = CASE WHEN $3 THEN COALESCE(archived_at, now()) ELSE NULL END
      WHERE id = $1 AND org_id = $2
      RETURNING id`,
    [sessionId, actor.orgId, archived],
  );
  if (rows.length === 0) {
    throw new SessionNotFoundError();
  }
  await recordAudit(db, {
    actor,
    action: archived ? 'session.archive' : 'session.unarchive',
    entity: 'session',
    entityId: sessionId,
    data: {},
  });
}

/** Sets whether a session has a public page, and audits it. Throws SessionNotFoundError when the session is not in the camp. */
export async function setSessionPublicRow(db: Db, actor: Actor, sessionId: string, isPublic: boolean): Promise<void> {
  const { rows } = await db.query<{ id: string }>(
    'UPDATE classes SET is_public = $3 WHERE id = $1 AND org_id = $2 RETURNING id',
    [sessionId, actor.orgId, isPublic],
  );
  if (rows.length === 0) {
    throw new SessionNotFoundError();
  }
  await recordAudit(db, {
    actor,
    action: 'session.update',
    entity: 'session',
    entityId: sessionId,
    data: { isPublic },
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
  const price = input.price;
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessions (org_id, class_id, name, age_min, age_max, starts_at, ends_at, location, capacity,
                           price_minor, price_currency, early_bird_minor, early_bird_until)
     SELECT $1, p.id, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9, $10, $11, $12, $13::date
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
      price?.regularMinor ?? null,
      price?.currency ?? null,
      price?.earlyBirdMinor ?? null,
      price?.earlyBirdUntil ?? null,
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
  if (price) {
    await recordAudit(db, {
      actor,
      action: 'class.price_change',
      entity: 'class',
      entityId: id,
      data: priceChangeAudit(null, price),
    });
  }

  return id;
}

/**
 * Updates a class's own fields and replaces its instructors. The camp-size floor is a trigger (migration 0008) and the function
 * that replaces instructors is in migration 0022. Throws ClassNotFoundError when the class is not in the camp.
 */
export async function updateClassRow(db: Db, actor: Actor, classId: string, input: ClassRecord): Promise<void> {
  // The row is locked first, so the price audit records the price that was really replaced.
  const { rows: current } = await db.query<PriceRow & { id: string }>(
    `SELECT id, price_minor, price_currency, early_bird_minor, to_char(early_bird_until, 'YYYY-MM-DD') AS early_bird_until
       FROM sessions WHERE id = $1 AND org_id = $2 FOR UPDATE`,
    [classId, actor.orgId],
  );
  if (current.length === 0) {
    throw new ClassNotFoundError();
  }
  const before = toPrice(current[0]);
  const price = input.price;
  await db.query(
    `UPDATE sessions
        SET name = $3, age_min = $4, age_max = $5, starts_at = $6::timestamptz, ends_at = $7::timestamptz,
            location = $8, capacity = $9, price_minor = $10, price_currency = $11, early_bird_minor = $12,
            early_bird_until = $13::date
      WHERE id = $1 AND org_id = $2`,
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
      price?.regularMinor ?? null,
      price?.currency ?? null,
      price?.earlyBirdMinor ?? null,
      price?.earlyBirdUntil ?? null,
    ],
  );
  const instructors = await requireInstructors(db, input.instructorIds);
  await db.query('SELECT buxa_replace_class_instructors_v2($1, $2, $3::uuid[])', [actor.orgId, classId, instructors]);
  await recordAudit(db, {
    actor,
    action: 'class.update',
    entity: 'class',
    entityId: classId,
    data: { startsAt: input.startsAt, endsAt: input.endsAt, capacity: input.capacity, instructorIds: instructors },
  });
  if (!samePrice(before, price)) {
    await recordAudit(db, {
      actor,
      action: 'class.price_change',
      entity: 'class',
      entityId: classId,
      data: priceChangeAudit(before, price),
    });
  }
}

/** Deletes a class through buxa_delete_class (migration 0022), which refuses a class with enrolments. Audits `class.delete`. */
export async function deleteClassRow(db: Db, actor: Actor, classId: string, name: string): Promise<void> {
  await db.query('SELECT buxa_delete_class_v2($1, $2)', [actor.orgId, classId]);
  await recordAudit(db, { actor, action: 'class.delete', entity: 'class', entityId: classId, data: { name } });
}

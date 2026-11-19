import { isUuid, type Actor } from '@buxa/domain';
import type { NewSessionInput } from '@buxa/contracts';
import { recordAudit } from '../audit/recordAudit';
import { type Db } from '../people/pgRows';
import type { ClassRecord } from './ClassRepository';
import { ClassNotFoundError, InstructorNotFoundError, SessionNotFoundError } from './errors';

/*
 * Writes for sessions (the parent rows) and classes (the time-range rows). Each write audits itself in the same transaction.
 * Table names follow migration 0022: a session is a row of `classes`, a class is a row of `sessions`.
 */

/** Inserts a session (a date range that holds classes) and audits it. Returns its id. */
export async function insertSession(db: Db, actor: Actor, input: NewSessionInput): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO classes (org_id, name, description, starts_on, ends_on)
     VALUES ($1, $2, $3, $4::date, $5::date) RETURNING id`,
    [actor.orgId, input.name, input.description, input.startsOn, input.endsOn],
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

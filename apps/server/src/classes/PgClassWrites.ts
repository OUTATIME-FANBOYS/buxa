import { isUuid, type Actor } from '@buxa/domain';
import type { NewClassInput } from '@buxa/contracts';
import { recordAudit } from '../audit/recordAudit';
import { type Db } from '../people/pgRows';
import type { NewSessionRecord } from './ClassRepository';
import { ClassNotFoundError, InstructorNotFoundError } from './errors';

/** Inserts a class and audits it. Returns its id. */
export async function insertClass(db: Db, actor: Actor, input: NewClassInput): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO classes (org_id, name, description, age_min, age_max, default_capacity, ratio_campers, ratio_instructors)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      actor.orgId,
      input.name,
      input.description,
      input.ageRange.minAge,
      input.ageRange.maxAge,
      input.capacity,
      input.instructorRatio?.campers ?? null,
      input.instructorRatio?.instructors ?? null,
    ],
  );
  const id = rows[0].id;
  await recordAudit(db, { actor, action: 'class.create', entity: 'class', entityId: id, data: { name: input.name } });

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
 * Inserts a session for a class, copying the class's instructor ratio onto it (stored, not enforced), links its instructors
 * and audits it. The class must exist in the camp (the caller checks, and the composite key enforces it too).
 */
export async function insertSession(db: Db, actor: Actor, classId: string, input: NewSessionRecord): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
     SELECT $1, c.id, $3::timestamptz, $4::timestamptz, $5, $6, c.ratio_campers, c.ratio_instructors
       FROM classes c WHERE c.id = $2
     RETURNING id`,
    [actor.orgId, classId, input.startsAt, input.endsAt, input.location, input.capacity],
  );
  if (rows.length === 0) {
    throw new ClassNotFoundError();
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
    action: 'session.create',
    entity: 'session',
    entityId: id,
    data: { classId, startsAt: input.startsAt, endsAt: input.endsAt, instructorIds: instructors },
  });

  return id;
}

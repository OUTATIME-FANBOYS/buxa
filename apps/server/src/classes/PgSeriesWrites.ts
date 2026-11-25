import type { Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { type Db } from '../people/pgRows';
import type { ClassRecord, SeriesFields, SeriesRecord, SeriesSchedule } from './ClassRepository';
import { ClassNotFoundError, SessionNotFoundError } from './errors';
import { insertClass, requireInstructors } from './PgClassWrites';
import { priceChangeAudit } from './priceAudit';
import { lockLocationAndCheck } from './PgLocationRule';
import { toPrice, type PriceRow } from './PgClassQueries';

/**
 * Writes a series: its row, then one occurrence (a row of sessions) per day, each linked to the series. The caller runs this in
 * one transaction, so the series and all of its days are written, or none. Audits `series.create` once, and `class.create` for
 * each day (insertClass). Throws SessionNotFoundError, or InstructorNotFoundError.
 */
export async function insertSeries(db: Db, actor: Actor, sessionId: string, input: SeriesRecord): Promise<string> {
  await requireInstructors(db, input.instructorIds);
  await lockLocationAndCheck(db, actor.orgId, { name: input.name, location: input.location }, input.occurrences, null);
  const price = input.price;
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO class_series (org_id, class_id, name, age_min, age_max, capacity, location, weekdays,
                               series_starts_at, series_ends_at, price_minor, price_currency, early_bird_minor, early_bird_until)
     SELECT $1, p.id, $3, $4, $5, $6, $7, $8::smallint[], $9::timestamptz, $10::timestamptz, $11, $12, $13, $14::date
       FROM classes p WHERE p.id = $2
     RETURNING id`,
    [
      actor.orgId,
      sessionId,
      input.name,
      input.ageRange.minAge,
      input.ageRange.maxAge,
      input.capacity,
      input.location,
      input.weekdays,
      input.seriesStartsAt,
      input.seriesEndsAt,
      price?.regularMinor ?? null,
      price?.currency ?? null,
      price?.earlyBirdMinor ?? null,
      price?.earlyBirdUntil ?? null,
    ],
  );
  if (rows.length === 0) {
    throw new SessionNotFoundError();
  }
  const seriesId = rows[0].id;
  for (const occurrence of input.occurrences) {
    await insertClass(db, actor, sessionId, dayRecord(input, occurrence), seriesId);
  }
  await recordAudit(db, {
    actor,
    action: 'series.create',
    entity: 'series',
    entityId: seriesId,
    data: { sessionId, name: input.name, weekdays: input.weekdays.map(String), days: input.occurrences.length },
  });

  return seriesId;
}

/** One day of a series as a class record: the series' shared fields with the day's own times. */
function dayRecord(fields: SeriesFields, day: { startsAt: string; endsAt: string }): ClassRecord {
  return {
    name: fields.name,
    ageRange: fields.ageRange,
    capacity: fields.capacity,
    startsAt: day.startsAt,
    endsAt: day.endsAt,
    location: fields.location,
    instructorIds: fields.instructorIds,
    price: fields.price,
  };
}

/**
 * Saves a series' shared fields on the series row and on every day of it, and replaces the instructors of every day. The days keep
 * their own times and status. Audits `series.update`. A camp size below the places taken is refused by the capacity trigger
 * (migration 0061), which the caller translates.
 */
export async function updateSeriesRow(
  db: Db,
  actor: Actor,
  seriesId: string,
  input: SeriesFields,
  schedule: SeriesSchedule | null,
): Promise<void> {
  const { rows: current } = await db.query<PriceRow & { id: string }>(
    `SELECT id, price_minor, price_currency, early_bird_minor, to_char(early_bird_until, 'YYYY-MM-DD') AS early_bird_until
       FROM class_series WHERE id = $1 AND org_id = $2 FOR UPDATE`,
    [seriesId, actor.orgId],
  );
  if (current.length === 0) {
    throw new ClassNotFoundError();
  }
  const before = toPrice(current[0]);
  const price = input.price;
  const instructors = await requireInstructors(db, input.instructorIds);
  // The days the series keeps, and the days a reschedule adds, must not overlap a class in the new location. Removed days take no place.
  const { rows: active } = await db.query<{ id: string; starts_at: Date; ends_at: Date }>(
    `SELECT id, starts_at, ends_at FROM sessions WHERE series_id = $1 AND org_id = $2 AND status = 'active'`,
    [seriesId, actor.orgId],
  );
  const removed = new Set(schedule?.removeIds ?? []);
  const placed = [
    ...active
      .filter(d => !removed.has(d.id))
      .map(d => ({ startsAt: d.starts_at.toISOString(), endsAt: d.ends_at.toISOString() })),
    ...(schedule?.add ?? []),
  ];
  await lockLocationAndCheck(db, actor.orgId, { name: input.name, location: input.location }, placed, seriesId);
  await db.query(
    `UPDATE class_series
        SET name = $3, age_min = $4, age_max = $5, capacity = $6, location = $7,
            price_minor = $8, price_currency = $9, early_bird_minor = $10, early_bird_until = $11::date
      WHERE id = $1 AND org_id = $2`,
    [
      seriesId,
      actor.orgId,
      input.name,
      input.ageRange.minAge,
      input.ageRange.maxAge,
      input.capacity,
      input.location,
      price?.regularMinor ?? null,
      price?.currency ?? null,
      price?.earlyBirdMinor ?? null,
      price?.earlyBirdUntil ?? null,
    ],
  );
  await db.query(
    `UPDATE sessions
        SET name = $3, age_min = $4, age_max = $5, capacity = $6, location = $7,
            price_minor = $8, price_currency = $9, early_bird_minor = $10, early_bird_until = $11::date
      WHERE series_id = $1 AND org_id = $2`,
    [
      seriesId,
      actor.orgId,
      input.name,
      input.ageRange.minAge,
      input.ageRange.maxAge,
      input.capacity,
      input.location,
      price?.regularMinor ?? null,
      price?.currency ?? null,
      price?.earlyBirdMinor ?? null,
      price?.earlyBirdUntil ?? null,
    ],
  );
  if (schedule) {
    await applySchedule(db, actor, seriesId, input, schedule);
  }
  const { rows: days } = await db.query<{ id: string }>(
    'SELECT id FROM sessions WHERE series_id = $1 AND org_id = $2 ORDER BY starts_at, id',
    [seriesId, actor.orgId],
  );
  for (const day of days) {
    await db.query('SELECT buxa_replace_class_instructors_v2($1, $2, $3::uuid[])', [actor.orgId, day.id, instructors]);
  }
  await recordAudit(db, {
    actor,
    action: 'series.update',
    entity: 'series',
    entityId: seriesId,
    data: {
      name: input.name,
      capacity: input.capacity,
      instructorIds: instructors,
      days: days.length,
      ...priceChangeAudit(before, price),
    },
  });
}

/**
 * Applies a change to the days: the series' weekdays and first and last allowed times are written, the removed days are deleted
 * through buxa_delete_occurrences_v1 (which refuses a day with a place), and each added day is written with the saved fields (its
 * class.create audit is written by insertClass). Audits `series.reschedule`.
 */
async function applySchedule(
  db: Db,
  actor: Actor,
  seriesId: string,
  fields: SeriesFields,
  schedule: SeriesSchedule,
): Promise<void> {
  const { rows } = await db.query<{ class_id: string }>(
    'SELECT class_id FROM class_series WHERE id = $1 AND org_id = $2',
    [seriesId, actor.orgId],
  );
  const sessionId = rows[0]?.class_id;
  if (!sessionId) {
    throw new ClassNotFoundError();
  }
  await db.query(
    `UPDATE class_series SET weekdays = $3::smallint[], series_starts_at = $4::timestamptz, series_ends_at = $5::timestamptz
      WHERE id = $1 AND org_id = $2`,
    [seriesId, actor.orgId, schedule.weekdays, schedule.seriesStartsAt, schedule.seriesEndsAt],
  );
  if (schedule.removeIds.length > 0) {
    await db.query('SELECT buxa_delete_occurrences_v1($1, $2, $3::uuid[])', [
      actor.orgId,
      seriesId,
      schedule.removeIds,
    ]);
  }
  for (const day of schedule.add) {
    await insertClass(db, actor, sessionId, dayRecord(fields, day), seriesId);
  }
  await recordAudit(db, {
    actor,
    action: 'series.reschedule',
    entity: 'series',
    entityId: seriesId,
    data: {
      added: schedule.add.length,
      removed: schedule.removeIds.length,
      weekdays: schedule.weekdays.map(String),
    },
  });
}

/**
 * Deletes a series with all its days through buxa_delete_series_v1 (migration 0064), which refuses a series with an enrolment, a hold
 * or a registration. Audits `series.delete`.
 */
export async function deleteSeriesRow(db: Db, actor: Actor, seriesId: string, name: string): Promise<void> {
  await db.query('SELECT buxa_delete_series_v1($1, $2)', [actor.orgId, seriesId]);
  await recordAudit(db, { actor, action: 'series.delete', entity: 'series', entityId: seriesId, data: { name } });
}

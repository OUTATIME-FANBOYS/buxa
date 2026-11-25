import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import type { SeriesRecord } from '../ClassRepository';
import { ClassHasEnrolmentsError, ClassNotFoundError } from '../errors';
import { auditActions, createClassFixture, enrolRule, makeSession, type ClassFixture } from './pgClassFixture';

const url = process.env.DATABASE_URL;

/** A three-day series, Monday to Wednesday 5 to 7 July 2027, 9:00 to 12:00 camp time. */
function threeDaySeries(name: string): SeriesRecord {
  const day = (d: number) => ({
    startsAt: `2027-07-0${d}T09:00:00+10:00`,
    endsAt: `2027-07-0${d}T12:00:00+10:00`,
  });

  return {
    name,
    ageRange: { minAge: 8, maxAge: 12 },
    capacity: 5,
    location: 'Studio 2',
    instructorIds: [],
    price: null,
    weekdays: [1, 2, 3],
    seriesStartsAt: '2027-07-05T09:00:00+10:00',
    seriesEndsAt: '2027-07-07T12:00:00+10:00',
    occurrences: [day(5), day(6), day(7)],
  };
}

// Deleting a series (or one of its days) is refused while the series has any enrolment, seat hold or registration, cancelled
// enrolments included, because their rows would otherwise be removed by the cascade. The database enforces this (migrations 0064
// and 0065); the repository translates the refusal into ClassHasEnrolmentsError. These need a real Postgres (DATABASE_URL).
describe.skipIf(!url)('deleting a class series on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  let fx: ClassFixture;
  beforeEach(async () => {
    fx = await createClassFixture(pool);
  });
  afterEach(async () => {
    await fx.close();
  });

  const countDays = async (seriesId: string): Promise<number> =>
    (await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM sessions WHERE series_id = $1', [seriesId]))
      .rows[0].n;

  const countSeries = async (seriesId: string): Promise<number> =>
    (await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM class_series WHERE id = $1', [seriesId])).rows[0]
      .n;

  const countEnrolments = async (seriesId: string): Promise<number> =>
    (await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM enrolments WHERE series_id = $1', [seriesId]))
      .rows[0].n;

  it('deletes an empty series with all its days, and audits the delete', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const series = await fx.repo.addSeries(fx.actor, session.id, threeDaySeries('Art camp'));
    expect(await countDays(series.id)).toBe(3);

    await fx.repo.deleteSeries(fx.actor, series.id);

    expect(await countSeries(series.id)).toBe(0);
    expect(await countDays(series.id)).toBe(0);
    expect(await auditActions(pool, fx.orgA)).toContain('series.delete');
  });

  it('refuses a series with one enrolment, and the enrolment and every day survive', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const series = await fx.repo.addSeries(fx.actor, session.id, threeDaySeries('Pottery camp'));
    const camper = await fx.addPerson(fx.orgA, '2016-03-01');
    const enrolment = await fx.repo.enrol(fx.actor, { classId: series.anchorClassId, camperId: camper }, enrolRule());

    await expect(fx.repo.deleteSeries(fx.actor, series.id)).rejects.toBeInstanceOf(ClassHasEnrolmentsError);

    expect(await countEnrolments(series.id)).toBe(1);
    const kept = await pool.query<{ id: string }>('SELECT id FROM enrolments WHERE id = $1', [enrolment.id]);
    expect(kept.rows).toHaveLength(1);
    expect(await countSeries(series.id)).toBe(1);
    expect(await countDays(series.id)).toBe(3);
  });

  it('refuses a series whose only enrolment is cancelled, and removes nothing', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const series = await fx.repo.addSeries(fx.actor, session.id, threeDaySeries('Swim camp'));
    const camper = await fx.addPerson(fx.orgA, '2016-03-01');
    const enrolment = await fx.repo.enrol(fx.actor, { classId: series.anchorClassId, camperId: camper }, enrolRule());
    await fx.repo.cancelEnrolment(fx.actor, enrolment.id, null);

    await expect(fx.repo.deleteSeries(fx.actor, series.id)).rejects.toBeInstanceOf(ClassHasEnrolmentsError);
    expect(await countEnrolments(series.id)).toBe(1);
    expect(await countDays(series.id)).toBe(3);
  });

  it('refuses one day of a series whose enrolment sits on another day, and removes nothing', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const series = await fx.repo.addSeries(fx.actor, session.id, threeDaySeries('Drama camp'));
    const camper = await fx.addPerson(fx.orgA, '2016-03-01');
    await fx.repo.enrol(fx.actor, { classId: series.anchorClassId, camperId: camper }, enrolRule());
    const days = await fx.repo.listSeriesOccurrences(fx.actor.userId, fx.orgA, series.id);
    const otherDay = days.find(d => d.id !== series.anchorClassId);
    expect(otherDay).toBeDefined();

    await expect(fx.repo.deleteClass(fx.actor, otherDay?.id ?? '')).rejects.toBeInstanceOf(ClassHasEnrolmentsError);
    expect(await countDays(series.id)).toBe(3);
  });

  it('a day of a series with no places can still be deleted on its own', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const series = await fx.repo.addSeries(fx.actor, session.id, threeDaySeries('Chess camp'));
    const days = await fx.repo.listSeriesOccurrences(fx.actor.userId, fx.orgA, series.id);

    await fx.repo.deleteClass(fx.actor, days[0]?.id ?? '');

    expect(await countDays(series.id)).toBe(2);
  });

  it('deleting a series of another camp is not found', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const series = await fx.repo.addSeries(fx.actor, session.id, threeDaySeries('Quiet camp'));

    await expect(fx.repo.deleteSeries(fx.otherActor, series.id)).rejects.toBeInstanceOf(ClassNotFoundError);
    expect(await countSeries(series.id)).toBe(1);
  });
});

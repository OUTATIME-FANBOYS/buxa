import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import type { SeriesRecord, SeriesSchedule } from '../ClassRepository';
import { ClassHasEnrolmentsError } from '../errors';
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

/** The series' fields as an edit saves them: the same as the series was written with. */
const fieldsOf = (series: SeriesRecord) => ({
  name: series.name,
  ageRange: series.ageRange,
  capacity: series.capacity,
  location: series.location,
  instructorIds: series.instructorIds,
  price: series.price,
});

/** The schedule an edit writes: the weekdays and allowed times, the days to add, and the active days to remove. */
const scheduleOf = (partial: Partial<SeriesSchedule> & Pick<SeriesSchedule, 'weekdays'>): SeriesSchedule => ({
  seriesStartsAt: '2027-07-05T09:00:00+10:00',
  seriesEndsAt: '2027-07-07T12:00:00+10:00',
  add: [],
  removeIds: [],
  ...partial,
});

// An edit of a series' days removes an active day only while no one has a place on the series. The removal runs through
// buxa_delete_occurrences_v1 (migration 0066), which refuses it with the class-has-enrolments error; added days are written with the
// saved fields. These need a real Postgres (DATABASE_URL).
describe.skipIf(!url)('editing the days of a class series on Postgres', () => {
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

  const dayStarts = async (seriesId: string): Promise<string[]> =>
    (
      await pool.query<{ starts: string }>(
        `SELECT to_char(starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS starts FROM sessions WHERE series_id = $1 ORDER BY starts_at`,
        [seriesId],
      )
    ).rows.map(r => r.starts);

  it('removes an active day no one is on, and writes the new weekdays, with a series.reschedule audit', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const series = await fx.repo.addSeries(fx.actor, session.id, threeDaySeries('Art camp'));
    const days = await fx.repo.listSeriesOccurrences(fx.actor.userId, fx.orgA, series.id);
    const tuesday = days.find(d => d.id !== series.anchorClassId);
    expect(tuesday).toBeDefined();

    await fx.repo.updateSeries(
      fx.actor,
      series.id,
      fieldsOf(threeDaySeries('Art camp')),
      scheduleOf({ weekdays: [1, 3], removeIds: [tuesday?.id ?? ''] }),
    );

    const updated = await fx.repo.getSeries(fx.actor.userId, fx.orgA, series.id);
    expect(updated?.weekdays).toEqual([1, 3]);
    expect(await dayStarts(series.id)).toHaveLength(2);
    expect(await auditActions(pool, fx.orgA)).toContain('series.reschedule');
  });

  it('adds a day with the series saved fields, and keeps the series enrolments', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const series = await fx.repo.addSeries(fx.actor, session.id, threeDaySeries('Pottery camp'));
    const camper = await fx.addPerson(fx.orgA, '2016-03-01');
    await fx.repo.enrol(fx.actor, { classId: series.anchorClassId, camperId: camper }, enrolRule());

    await fx.repo.updateSeries(
      fx.actor,
      series.id,
      { ...fieldsOf(threeDaySeries('Pottery camp')), location: 'Studio 3' },
      scheduleOf({
        weekdays: [1, 2, 3, 4],
        seriesEndsAt: '2027-07-08T12:00:00+10:00',
        add: [{ startsAt: '2027-07-08T09:00:00+10:00', endsAt: '2027-07-08T12:00:00+10:00' }],
      }),
    );

    expect(await dayStarts(series.id)).toHaveLength(4);
    const days = await fx.repo.listSeriesOccurrences(fx.actor.userId, fx.orgA, series.id);
    expect(days.every(d => d.location === 'Studio 3')).toBe(true);
    const enrolments = await pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM enrolments WHERE series_id = $1',
      [series.id],
    );
    expect(enrolments.rows[0]?.n).toBe(1);
  });

  it('refuses the removal of a day while a child is enrolled in the series, and changes nothing', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const series = await fx.repo.addSeries(fx.actor, session.id, threeDaySeries('Drama camp'));
    const camper = await fx.addPerson(fx.orgA, '2016-03-01');
    await fx.repo.enrol(fx.actor, { classId: series.anchorClassId, camperId: camper }, enrolRule());
    const days = await fx.repo.listSeriesOccurrences(fx.actor.userId, fx.orgA, series.id);
    const otherDay = days.find(d => d.id !== series.anchorClassId);

    await expect(
      fx.repo.updateSeries(
        fx.actor,
        series.id,
        fieldsOf(threeDaySeries('Drama camp')),
        scheduleOf({ weekdays: [1, 3], removeIds: [otherDay?.id ?? ''] }),
      ),
    ).rejects.toBeInstanceOf(ClassHasEnrolmentsError);

    expect(await dayStarts(series.id)).toHaveLength(3);
    const unchanged = await fx.repo.getSeries(fx.actor.userId, fx.orgA, series.id);
    expect(unchanged?.weekdays).toEqual([1, 2, 3]);
  });

  it('names the people with a place on the series, and nobody once the places are gone', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const series = await fx.repo.addSeries(fx.actor, session.id, threeDaySeries('Swim camp'));
    const camper = await fx.addPerson(fx.orgA, '2016-03-01');
    const enrolment = await fx.repo.enrol(fx.actor, { classId: series.anchorClassId, camperId: camper }, enrolRule());

    const named = await fx.repo.seriesHolders(fx.actor.userId, fx.orgA, series.id);
    expect(named).toHaveLength(1);

    await fx.repo.cancelEnrolment(fx.actor, enrolment.id, null);

    expect(await fx.repo.seriesHolders(fx.actor.userId, fx.orgA, series.id)).toEqual([]);
  });
});

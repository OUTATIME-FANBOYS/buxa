import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { createClassService } from '../ClassService';
import { RecurrenceRefusedError } from '../errors';
import type { SeriesRecord } from '../ClassRepository';
import { createClassFixture, makeSession, sessionInput, type ClassFixture } from './pgClassFixture';

const url = process.env.DATABASE_URL;

/** The reason a call was rejected with. It is read as unknown: a rejection can be any value. */
const reasonOf = (r: PromiseRejectedResult): unknown => r.reason;

/** Each race runs this many times on fresh rows, so one run covers several interleavings. */
const TRIALS = 5;

/** A one-day series on Monday 5 July 2027, 09:00 to 12:00 camp time, in the given location. */
function seriesOn(name: string, location: string, fromHour = 9, toHour = 12): SeriesRecord {
  const at = (h: number) => `2027-07-05T${String(h).padStart(2, '0')}:00:00+10:00`;

  return {
    name,
    ageRange: { minAge: 8, maxAge: 12 },
    capacity: 5,
    location,
    instructorIds: [],
    price: null,
    weekdays: [1],
    seriesStartsAt: at(fromHour),
    seriesEndsAt: at(toHour),
    occurrences: [{ startsAt: at(fromHour), endsAt: at(toHour) }],
  };
}

describe.skipIf(!url)('the location rule on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  it('refuses a same-location overlap through the service, naming the other class, its location and times', async () => {
    const fx: ClassFixture = await createClassFixture(pool);
    try {
      const service = createClassService({ repo: fx.repo, timezoneOf: () => Promise.resolve('Australia/Sydney') });
      const session = await makeSession(fx.repo, fx.actor);
      await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12));

      const refused = await service.addClass(fx.actor, session.id, sessionInput(10, 13, { name: 'Pottery Class' }));

      expect(refused.ok).toBe(false);
      if (refused.ok) {
        return;
      }
      expect(refused.failure.reason).toBe('class_clash');
      expect(refused.failure.message).toBe(
        'Pottery Class on 2027-07-05 clashes with Robotics at Lab 1 (Mon 5 Jul, 09:00-12:00). Two classes in the same location cannot overlap. Choose other times, days or a location; nothing was saved.',
      );
    } finally {
      await fx.close();
    }
  });

  it(`two parallel series in one location, overlapping in time: exactly one is written (${TRIALS} trials)`, async () => {
    const fx: ClassFixture = await createClassFixture(pool);
    try {
      for (let trial = 0; trial < TRIALS; trial++) {
        const session = await makeSession(fx.repo, fx.actor);
        const location = `Hall ${trial}`;

        const results = await Promise.allSettled([
          fx.repo.addSeries(fx.actor, session.id, seriesOn(`Pottery ${trial}`, location)),
          fx.repo.addSeries(fx.actor, session.id, seriesOn(`Choir ${trial}`, location, 10, 13)),
        ]);

        const wins = results.filter(r => r.status === 'fulfilled');
        const losses = results.flatMap(r => (r.status === 'rejected' ? [reasonOf(r)] : []));
        expect(wins, `trial ${trial}`).toHaveLength(1);
        expect(losses, `trial ${trial}`).toHaveLength(1);
        expect(losses[0], `trial ${trial}`).toBeInstanceOf(RecurrenceRefusedError);
        const listed = await fx.repo.listCampClassSpans(fx.actor.userId, fx.orgA);
        expect(
          listed.filter(s => s.location === location),
          `trial ${trial}`,
        ).toHaveLength(1);
      }
    } finally {
      await fx.close();
    }
  });

  it('two parallel series in different locations, overlapping in time, both succeed', async () => {
    const fx: ClassFixture = await createClassFixture(pool);
    try {
      const session = await makeSession(fx.repo, fx.actor);

      const results = await Promise.allSettled([
        fx.repo.addSeries(fx.actor, session.id, seriesOn('Pottery', 'Studio')),
        fx.repo.addSeries(fx.actor, session.id, seriesOn('Swim', 'Pool', 10, 13)),
      ]);

      expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled']);
    } finally {
      await fx.close();
    }
  });

  it('the database refuses an overlap in one location even when the app check is skipped', async () => {
    const fx: ClassFixture = await createClassFixture(pool);
    try {
      const session = await makeSession(fx.repo, fx.actor);
      await fx.repo.addSeries(fx.actor, session.id, seriesOn('Pottery', 'Studio'));
      const swim = await fx.repo.addSeries(fx.actor, session.id, seriesOn('Swim', 'Pool', 13, 15));
      const swimDay = swim.anchorClassId;

      // Move the swimming day into the pottery studio's time, bypassing the service: the exclusion constraint must refuse it.
      await expect(
        withOrg(pool, fx.actor.userId, fx.orgA, db =>
          db.query(
            `UPDATE sessions SET location = '  studio ', starts_at = '2027-07-05T09:30:00+10:00', ends_at = '2027-07-05T10:30:00+10:00'
              WHERE id = $1`,
            [swimDay],
          ),
        ),
      ).rejects.toMatchObject({ code: '23P01', constraint: 'sessions_location_overlap' });
    } finally {
      await fx.close();
    }
  });

  it('a cancelled day takes no place, so it may overlap a class in its location', async () => {
    const fx: ClassFixture = await createClassFixture(pool);
    try {
      const session = await makeSession(fx.repo, fx.actor);
      await fx.repo.addSeries(fx.actor, session.id, seriesOn('Pottery', 'Studio'));
      const choir = await fx.repo.addSeries(fx.actor, session.id, seriesOn('Choir', 'Pool'));
      await withOrg(pool, fx.actor.userId, fx.orgA, db =>
        db.query(
          `UPDATE sessions SET location = 'Studio', starts_at = '2027-07-05T09:30:00+10:00', ends_at = '2027-07-05T10:30:00+10:00',
                 status = 'cancelled', cancel_reason = 'Public holiday', cancelled_at = now()
            WHERE id = $1`,
          [choir.anchorClassId],
        ),
      );
    } finally {
      await fx.close();
    }
  });
});

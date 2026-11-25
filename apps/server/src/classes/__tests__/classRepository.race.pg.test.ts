import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { OverlapError, SessionFullError } from '../errors';
import { createClassFixture, enrolRule, makeSession, sessionInput, type ClassFixture } from './pgClassFixture';

const url = process.env.DATABASE_URL;

/** Each race is run this many times inside one test, on fresh rows each time, so one run already covers many interleavings. */
const TRIALS = 10;

/** Two concurrent calls: the outcome of each, in order. */
const settle = <T>(calls: [Promise<T>, Promise<T>]) => Promise.allSettled(calls);
/** The reason a call was rejected with. A rejection can be any value, so it is read as unknown. */
const reasonOf = (r: PromiseRejectedResult): unknown => r.reason;

describe.skipIf(!url)('enrolment races on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  it(`two parallel enrolments for the last place give exactly one success (${TRIALS} trials)`, async () => {
    const fx: ClassFixture = await createClassFixture(pool);
    try {
      for (let trial = 0; trial < TRIALS; trial++) {
        const session = await makeSession(fx.repo, fx.actor);
        // Each trial has its own location: classes in one location may not overlap, and the trials share one camp.
        const cls = await fx.repo.addClass(
          fx.actor,
          session.id,
          sessionInput(9, 12, { capacity: 1, location: `Lab ${trial}` }),
        );
        const ada = await fx.addPerson(fx.orgA, '2016-03-01', `Ada${trial}`);
        const ben = await fx.addPerson(fx.orgA, '2016-03-01', `Ben${trial}`);

        const results = await settle([
          fx.repo.enrol(fx.actor, { classId: cls.id, camperId: ada }, enrolRule()),
          fx.repo.enrol(fx.actor, { classId: cls.id, camperId: ben }, enrolRule()),
        ]);

        const wins = results.filter(r => r.status === 'fulfilled');
        const losses = results.flatMap(r => (r.status === 'rejected' ? [reasonOf(r)] : []));
        expect(wins, `trial ${trial}`).toHaveLength(1);
        expect(losses, `trial ${trial}`).toHaveLength(1);
        expect(losses[0], `trial ${trial}`).toBeInstanceOf(SessionFullError);
        expect((await fx.repo.getClass(fx.actor.userId, fx.orgA, cls.id))?.seatsTaken, `trial ${trial}`).toBe(1);
      }
    } finally {
      await fx.close();
    }
  });

  it(`two parallel enrolments for one camper in overlapping classes give exactly one success (${TRIALS} trials)`, async () => {
    const fx: ClassFixture = await createClassFixture(pool);
    try {
      for (let trial = 0; trial < TRIALS; trial++) {
        const session = await makeSession(fx.repo, fx.actor);
        // Overlapping in time, in two locations: the child rule applies across locations, the location rule does not.
        const morning = await fx.repo.addClass(
          fx.actor,
          session.id,
          sessionInput(9, 12, { name: 'Robotics', location: `Lab ${trial}` }),
        );
        const overlapping = await fx.repo.addClass(
          fx.actor,
          session.id,
          sessionInput(11, 13, { name: 'Painting', location: `Hall ${trial}` }),
        );
        const camper = await fx.addPerson(fx.orgA, '2016-03-01', `Cam${trial}`);

        const results = await settle([
          fx.repo.enrol(fx.actor, { classId: morning.id, camperId: camper }, enrolRule()),
          fx.repo.enrol(fx.actor, { classId: overlapping.id, camperId: camper }, enrolRule()),
        ]);

        const wins = results.filter(r => r.status === 'fulfilled');
        const losses = results.flatMap(r => (r.status === 'rejected' ? [reasonOf(r)] : []));
        expect(wins, `trial ${trial}`).toHaveLength(1);
        expect(losses, `trial ${trial}`).toHaveLength(1);
        expect(losses[0], `trial ${trial}`).toBeInstanceOf(OverlapError);

        const live = await fx.pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM enrolments WHERE person_id = $1 AND status = 'enrolled'`,
          [camper],
        );
        expect(live.rows[0].n, `trial ${trial}`).toBe(1);
      }
    } finally {
      await fx.close();
    }
  });
});

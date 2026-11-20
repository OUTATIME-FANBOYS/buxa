import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { holdExpiresAt } from '@buxa/domain';
import { SessionFullError } from '../../classes/errors';
import { PgSeatHoldRepository } from '../PgSeatHoldRepository';
import {
  createClassFixture,
  enrolRule,
  makeSession,
  sessionInput,
  type ClassFixture,
} from '../../classes/__tests__/pgClassFixture';

const url = process.env.DATABASE_URL;

/** Each race runs this many times on fresh rows, so one run covers many interleavings. */
const TRIALS = 5;

/** The reason a call was rejected with. A rejection can be any value, so it is read as unknown. */
const reasonOf = (r: PromiseRejectedResult): unknown => r.reason;

/** Places taken right now: enrolled campers plus unexpired, unreleased holds. Read in its own statement, after the races settle. */
async function placesTaken(fx: ClassFixture, classId: string): Promise<number> {
  return withOrg(fx.pool, fx.actor.userId, fx.orgA, async db => {
    const { rows } = await db.query<{ taken: number }>(`SELECT session_seats_taken($1)::int AS taken`, [classId]);

    return rows[0].taken;
  });
}

async function activeHolds(fx: ClassFixture, classId: string): Promise<number> {
  return withOrg(fx.pool, fx.actor.userId, fx.orgA, async db => {
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM seat_holds WHERE session_id = $1 AND released_at IS NULL AND expires_at > now()`,
      [classId],
    );

    return rows[0].n;
  });
}

async function addHousehold(fx: ClassFixture, label: string): Promise<string> {
  return withOrg(
    fx.pool,
    fx.actor.userId,
    fx.orgA,
    async db =>
      (
        await db.query<{ id: string }>(`INSERT INTO households (org_id, name) VALUES ($1, $2) RETURNING id`, [
          fx.orgA,
          label,
        ])
      ).rows[0].id,
  );
}

describe.skipIf(!url)('seat hold races on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url, max: 20 });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  it(`N parallel holds against K places never create more than K active holds (${TRIALS} trials)`, async () => {
    const fx = await createClassFixture(pool);
    const holds = new PgSeatHoldRepository(pool);
    const K = 3;
    const N = 8;
    try {
      for (let trial = 0; trial < TRIALS; trial++) {
        const session = await makeSession(fx.repo, fx.actor);
        const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { capacity: K }));
        const households = await Promise.all(
          Array.from({ length: N }, (_, i) => addHousehold(fx, `Family ${trial}-${i}`)),
        );

        const results = await Promise.allSettled(
          households.map(householdId =>
            holds.placeHold(fx.actor, { sessionId: cls.id, householdId, expiresAt: holdExpiresAt(new Date()) }),
          ),
        );

        const wins = results.filter(r => r.status === 'fulfilled');
        const losses = results.flatMap(r => (r.status === 'rejected' ? [reasonOf(r)] : []));
        expect(wins, `trial ${trial}`).toHaveLength(K);
        expect(losses, `trial ${trial}`).toHaveLength(N - K);
        for (const loss of losses) {
          expect(loss, `trial ${trial}`).toBeInstanceOf(SessionFullError);
        }
        expect(await activeHolds(fx, cls.id), `trial ${trial}`).toBe(K);
        expect(await placesTaken(fx, cls.id), `trial ${trial}`).toBe(K);
      }
    } finally {
      await fx.close();
    }
  });

  it(`holds and enrolments racing for K places never take more than K (${TRIALS} trials)`, async () => {
    const fx = await createClassFixture(pool);
    const holds = new PgSeatHoldRepository(pool);
    const K = 2;
    try {
      for (let trial = 0; trial < TRIALS; trial++) {
        const session = await makeSession(fx.repo, fx.actor);
        const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { capacity: K }));
        const households = await Promise.all([0, 1, 2].map(i => addHousehold(fx, `Race ${trial}-${i}`)));
        const campers = await Promise.all([0, 1, 2].map(i => fx.addPerson(fx.orgA, '2016-03-01', `Racer${trial}${i}`)));

        const calls = [
          ...households.map(householdId =>
            holds.placeHold(fx.actor, { sessionId: cls.id, householdId, expiresAt: holdExpiresAt(new Date()) }),
          ),
          ...campers.map(camperId => fx.repo.enrol(fx.actor, { classId: cls.id, camperId }, enrolRule())),
        ];
        const results = await Promise.allSettled(calls);

        const wins = results.filter(r => r.status === 'fulfilled');
        const losses = results.flatMap(r => (r.status === 'rejected' ? [reasonOf(r)] : []));
        expect(wins, `trial ${trial}`).toHaveLength(K);
        for (const loss of losses) {
          expect(loss, `trial ${trial}`).toBeInstanceOf(SessionFullError);
        }
        expect(await placesTaken(fx, cls.id), `trial ${trial}`).toBe(K);
      }
    } finally {
      await fx.close();
    }
  });

  it(`a hold and a new registration racing for the last place never both succeed (${TRIALS} trials)`, async () => {
    const fx = await createClassFixture(pool);
    const holds = new PgSeatHoldRepository(pool);
    try {
      for (let trial = 0; trial < TRIALS; trial++) {
        const session = await makeSession(fx.repo, fx.actor);
        const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { capacity: 1 }));
        const household = await addHousehold(fx, `Last ${trial}`);
        const camper = await fx.addPerson(fx.orgA, '2016-03-01', `Last${trial}`);

        const results = await Promise.allSettled([
          holds.placeHold(fx.actor, {
            sessionId: cls.id,
            householdId: household,
            expiresAt: holdExpiresAt(new Date()),
          }),
          fx.repo.enrol(fx.actor, { classId: cls.id, camperId: camper }, enrolRule()),
        ]);

        const wins = results.filter(r => r.status === 'fulfilled');
        expect(wins, `trial ${trial}`).toHaveLength(1);
        expect(await placesTaken(fx, cls.id), `trial ${trial}`).toBe(1);
      }
    } finally {
      await fx.close();
    }
  });
});

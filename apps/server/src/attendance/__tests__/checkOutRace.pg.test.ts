import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { createPgFixture } from '../../people/__tests__/pgFixture';
import { samplePerson, type RepositoryFixture } from '../../people/__tests__/fixture';
import { untilBlocked } from '../../__tests__/untilBlocked';
import { isNotOnSite, type CheckInRecord } from '../AttendanceRepository';

const url = process.env.DATABASE_URL;
const MORNING = '2027-07-01T08:00:00.000Z';
const NOON = '2027-07-01T12:00:00.000Z';
const LATER = '2027-07-01T12:00:05.000Z';

// Audit S-01. Two check-outs for one open visit on the real database. Exactly one may close the visit, and the stored
// collector must be the winner's. Without the open-visit condition on the UPDATE, the second check-out overwrites who
// collected the child.
describe.skipIf(!url)('check-out race on Postgres (S-01)', () => {
  const pool = new pg.Pool({ connectionString: url, max: 5, application_name: 'buxa-race-checkout' });
  let fx: RepositoryFixture;

  beforeAll(async () => {
    await migrate(pool);
    fx = await createPgFixture(pool);
  });
  afterAll(async () => {
    await fx?.close();
    await pool.end();
  });

  const people = async (label: string) => ({
    child: (await fx.repos.people.create(fx.actor, samplePerson({ givenName: `Child ${label}` }))).id,
    first: (await fx.repos.people.create(fx.actor, samplePerson({ givenName: `Parent ${label}` }))).id,
    second: (await fx.repos.people.create(fx.actor, samplePerson({ givenName: `Uncle ${label}` }))).id,
  });

  it('a check-out that waits behind a committed one is refused, and the first collector is kept', async () => {
    const { child, first, second } = await people('held');
    await fx.repos.attendance.checkIn(fx.actor, {
      personId: child,
      at: MORNING,
      method: 'qr',
      overrideReason: null,
      note: null,
    });

    // The first check-out is written in a transaction that stays open, so the second one must wait on the same row.
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('SET LOCAL ROLE buxa_app');
      await holder.query("SELECT set_config('app.org_id', $1, true)", [fx.actor.orgId]);
      await holder.query(
        `UPDATE check_ins SET checked_out_at = $2::timestamptz, checked_out_by = $3, collected_by_person_id = $4
          WHERE person_id = $1 AND checked_out_at IS NULL`,
        [child, NOON, fx.actor.userId, first],
      );

      const second$ = fx.repos.attendance
        .checkOut(fx.actor, {
          personId: child,
          at: LATER,
          collectedByPersonId: second,
          overrideReason: null,
          note: null,
        })
        .then(
          () => 'won' as const,
          (error: unknown) => error,
        );
      await untilBlocked(pool, 'buxa-race-checkout');
      await holder.query('COMMIT');

      expect(isNotOnSite(await second$)).toBe(true);
    } finally {
      holder.release();
    }

    const stored = await withOrg(
      pool,
      fx.actor.orgId,
      async db =>
        (
          await db.query<{ collected_by_person_id: string; checked_out_at: Date }>(
            'SELECT collected_by_person_id, checked_out_at FROM check_ins WHERE person_id = $1',
            [child],
          )
        ).rows,
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].collected_by_person_id).toBe(first);
    expect(stored[0].checked_out_at.toISOString()).toBe(NOON);
  });

  it('five overlapping check-outs in a row: exactly one succeeds each time, and its collector is the one stored', async () => {
    for (let round = 0; round < 5; round++) {
      const { child, first, second } = await people(`round ${round}`);
      await fx.repos.attendance.checkIn(fx.actor, {
        personId: child,
        at: MORNING,
        method: 'qr',
        overrideReason: null,
        note: null,
      });

      const outcomes = await Promise.allSettled([
        fx.repos.attendance.checkOut(fx.actor, {
          personId: child,
          at: NOON,
          collectedByPersonId: first,
          overrideReason: null,
          note: null,
        }),
        fx.repos.attendance.checkOut(fx.actor, {
          personId: child,
          at: LATER,
          collectedByPersonId: second,
          overrideReason: null,
          note: null,
        }),
      ]);
      const won = outcomes.filter((o): o is PromiseFulfilledResult<CheckInRecord> => o.status === 'fulfilled');
      const lost = outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected');
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      expect(isNotOnSite(lost[0].reason)).toBe(true);

      const stored = await withOrg(
        pool,
        fx.actor.orgId,
        async db =>
          (
            await db.query<{ collected_by_person_id: string }>(
              'SELECT collected_by_person_id FROM check_ins WHERE person_id = $1',
              [child],
            )
          ).rows,
      );
      expect(stored[0].collected_by_person_id).toBe(won[0].value.collectedByPersonId);
    }
  });
});

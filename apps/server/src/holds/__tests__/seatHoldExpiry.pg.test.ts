import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { SEAT_HOLD_MINUTES } from '@buxa/domain';
import {
  createClassFixture,
  makeSession,
  sessionInput,
  type ClassFixture,
} from '../../classes/__tests__/pgClassFixture';
import { PgSeatHoldRepository } from '../PgSeatHoldRepository';
import { PgClassRepository } from '../../classes/PgClassRepository';
import { createSeatHoldService, type SeatHoldService } from '../SeatHoldService';

/*
 * Seat holds in Postgres: capacity under concurrent holds, a hold that lasts 15 minutes and then frees its place, and the cleanup
 * that releases expired holds in every camp. Needs DATABASE_URL.
 */

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('seat holds in Postgres: capacity and expiry', () => {
  const pool = new pg.Pool({ connectionString: url });
  const seats: SeatHoldService = createSeatHoldService({
    repo: new PgSeatHoldRepository(pool),
    classes: new PgClassRepository(pool),
    timezoneOf: () => Promise.resolve('Australia/Sydney'),
    holdMinutesOf: () => Promise.resolve(null),
  });

  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  /** A camp with one class of the given size, and a household for each name. */
  async function setUp(capacity: number, households: string[]) {
    const fx: ClassFixture = await createClassFixture(pool);
    const session = await makeSession(fx.repo, fx.actor);
    const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { capacity }));
    const ids = await withOrg(pool, fx.actor.userId, fx.orgA, async db => {
      const out: string[] = [];
      for (const name of households) {
        const { rows } = await db.query<{ id: string }>(
          `INSERT INTO households (org_id, name) VALUES ($1, $2) RETURNING id`,
          [fx.orgA, name],
        );
        out.push(rows[0].id);
      }

      return out;
    });

    return { fx, classId: cls.id, householdIds: ids };
  }

  it('concurrent holds on a 2-place class take exactly 2 places', async () => {
    const names = ['Ana', 'Ben', 'Cal', 'Dot', 'Eli'];
    const { fx, classId, householdIds } = await setUp(2, names);

    const outcomes = await Promise.all(
      householdIds.map(householdId => seats.placeHold(fx.actor, { classId, householdId })),
    );

    expect(outcomes.filter(o => o.ok)).toHaveLength(2);
    expect(outcomes.filter(o => !o.ok && o.failure.reason === 'session_full')).toHaveLength(3);
    const active = await withOrg(pool, fx.actor.userId, fx.orgA, async db => {
      const { rows } = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM seat_holds WHERE session_id = $1 AND released_at IS NULL AND expires_at > now()`,
        [classId],
      );

      return rows[0].n;
    });
    expect(active).toBe(2);
  });

  it('a hold lasts SEAT_HOLD_MINUTES; once it has passed, its place is free without any cleanup', async () => {
    const { fx, classId, householdIds } = await setUp(1, ['Ada', 'Bea']);
    const held = await seats.placeHold(fx.actor, { classId, householdId: householdIds[0] });
    expect(held).toMatchObject({ ok: true });
    if (!held.ok) {
      throw new Error('the first hold should be taken');
    }
    const minutes = (Date.parse(held.value.expiresAt) - Date.parse(held.value.createdAt)) / 60_000;
    // The database and this process read the clock separately, so allow a second of difference.
    expect(Math.abs(minutes - SEAT_HOLD_MINUTES)).toBeLessThan(1 / 60);

    await expect(seats.placeHold(fx.actor, { classId, householdId: householdIds[1] })).resolves.toMatchObject({
      ok: false,
      failure: { reason: 'session_full' },
    });

    await pool.query(`UPDATE seat_holds SET expires_at = now() - interval '1 second' WHERE id = $1`, [held.value.id]);

    await expect(seats.placeHold(fx.actor, { classId, householdId: householdIds[1] })).resolves.toMatchObject({
      ok: true,
    });
  });

  it('the cleanup releases expired holds in every camp, marks them expired, and leaves live holds alone', async () => {
    const { fx, classId, householdIds } = await setUp(2, ['Cy', 'Dee']);
    const [first, second] = await Promise.all(
      householdIds.map(householdId => seats.placeHold(fx.actor, { classId, householdId })),
    );
    if (!first?.ok || !second?.ok) {
      throw new Error('both holds should be taken');
    }
    await pool.query(`UPDATE seat_holds SET expires_at = now() - interval '1 second' WHERE id = $1`, [first.value.id]);

    const sweep = await seats.releaseExpiredHoldsEverywhere();
    expect(sweep.camps).toBeGreaterThanOrEqual(1);
    expect(sweep.released).toBeGreaterThanOrEqual(1);

    const rows = await withOrg(pool, fx.actor.userId, fx.orgA, async db => {
      const { rows: found } = await db.query<{ id: string; released_at: Date | null; release_reason: string | null }>(
        `SELECT id, released_at, release_reason FROM seat_holds WHERE session_id = $1 ORDER BY created_at`,
        [classId],
      );

      return found;
    });
    const expired = rows.find(r => r.id === first.value.id);
    const live = rows.find(r => r.id === second.value.id);
    expect(expired?.release_reason).toBe('expired');
    expect(live?.released_at).toBeNull();

    // Running it again finds nothing new in this camp.
    expect(await seats.releaseExpiredHolds(fx.actor.userId, fx.orgA)).toBe(0);
  });

  it('the table accepts the completed release reason that a confirmed registration will use', async () => {
    const { fx, classId, householdIds } = await setUp(1, ['Eli']);
    const held = await seats.placeHold(fx.actor, { classId, householdId: householdIds[0] });
    if (!held.ok) {
      throw new Error('the hold should be taken');
    }

    await expect(
      pool.query(`UPDATE seat_holds SET released_at = now(), release_reason = 'completed' WHERE id = $1`, [
        held.value.id,
      ]),
    ).resolves.toMatchObject({ rowCount: 1 });
  });
});

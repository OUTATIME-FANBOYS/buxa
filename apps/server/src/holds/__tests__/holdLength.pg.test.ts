import { PgClassRepository } from '../../classes/PgClassRepository';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { SEAT_HOLD_MINUTES, type Actor } from '@buxa/domain';
import {
  createClassFixture,
  makeSession,
  sessionInput,
  type ClassFixture,
} from '../../classes/__tests__/pgClassFixture';
import { isHttpError } from '../../http/errors';
import { PgOrgRepository } from '../../orgs/PgOrgRepository';
import { createOrgService, type OrgService } from '../../services/orgs';
import { PgSeatHoldRepository } from '../PgSeatHoldRepository';
import { createSeatHoldService, type SeatHoldService } from '../SeatHoldService';

/*
 * A camp's seat hold length in Postgres: a hold placed after a change uses the new length, a hold placed before keeps its time,
 * the database refuses a value outside 5 to 60, and a staff member cannot change it. Needs DATABASE_URL.
 */

const url = process.env.DATABASE_URL;
const MINUTE_TOLERANCE = 1 / 60;

describe.skipIf(!url)('seat hold length per camp in Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  const orgs = new PgOrgRepository(pool);
  const camp: OrgService = createOrgService(orgs);
  const seats: SeatHoldService = createSeatHoldService({
    repo: new PgSeatHoldRepository(pool),
    classes: new PgClassRepository(pool),
    timezoneOf: () => Promise.resolve('Australia/Sydney'),
    holdMinutesOf: async scope => (await orgs.get(scope.userId, scope.orgId)).holdMinutes,
  });
  let fx: ClassFixture;
  let staff: Actor;

  beforeAll(async () => {
    await migrate(pool);
    fx = await createClassFixture(pool);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Staff hold length') RETURNING id`,
      [`staff-hold-${randomBytes(6).toString('hex')}@example.test`],
    );
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'staff')`, [fx.orgA, rows[0].id]);
    staff = { userId: rows[0].id, orgId: fx.orgA, role: 'staff' };
  });

  afterAll(async () => {
    await fx.close();
    await pool.end();
  });

  /** A class with room for many holds, and three households to hold it for. */
  async function setUp() {
    const session = await makeSession(fx.repo, fx.actor);
    const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { capacity: 10 }));
    const householdIds = await withOrg(pool, fx.actor.userId, fx.orgA, async db => {
      const out: string[] = [];
      for (const name of ['Ada', 'Bea', 'Cy']) {
        const { rows } = await db.query<{ id: string }>(
          `INSERT INTO households (org_id, name) VALUES ($1, $2) RETURNING id`,
          [fx.orgA, `${name} ${randomBytes(3).toString('hex')}`],
        );
        out.push(rows[0].id);
      }

      return out;
    });

    return { classId: cls.id, householdIds };
  }

  /** The minutes a stored hold lasts, read back from the database (expiry minus creation). */
  async function storedMinutes(holdId: string): Promise<number> {
    const { rows } = await pool.query<{ minutes: number }>(
      `SELECT extract(epoch FROM (expires_at - created_at)) / 60 AS minutes FROM seat_holds WHERE id = $1`,
      [holdId],
    );

    return rows[0].minutes;
  }

  /** Sets the camp's length as the owner, through the service (the path the settings form takes). */
  const setLength = (holdMinutes: number | null) => camp.setHoldLength(fx.actor, { holdMinutes });

  it('a hold placed after the change uses the new length; a hold placed before keeps its own time', async () => {
    await setLength(null);
    const { classId, householdIds } = await setUp();

    const before = await seats.placeHold(fx.actor, { classId, householdId: householdIds[0] });
    expect(before.ok).toBe(true);
    await setLength(45);
    const after = await seats.placeHold(fx.actor, { classId, householdId: householdIds[1] });
    expect(after.ok).toBe(true);
    if (!before.ok || !after.ok) {
      throw new Error('both holds should be taken');
    }

    expect(Math.abs((await storedMinutes(before.value.id)) - SEAT_HOLD_MINUTES)).toBeLessThan(MINUTE_TOLERANCE);
    expect(Math.abs((await storedMinutes(after.value.id)) - 45)).toBeLessThan(MINUTE_TOLERANCE);
  });

  it('null uses the default, 15 minutes', async () => {
    await setLength(null);
    const { classId, householdIds } = await setUp();

    const held = await seats.placeHold(fx.actor, { classId, householdId: householdIds[0] });
    expect(held.ok).toBe(true);
    if (!held.ok) {
      throw new Error('the hold should be taken');
    }
    expect(Math.abs((await storedMinutes(held.value.id)) - SEAT_HOLD_MINUTES)).toBeLessThan(MINUTE_TOLERANCE);
  });

  it('the service refuses a length outside 5 to 60 (400) and keeps the one it had', async () => {
    await setLength(30);

    for (const value of [4, 61, 7.5]) {
      const error = await camp.setHoldLength(fx.actor, { holdMinutes: value }).then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(isHttpError(error) && error.statusCode).toBe(400);
    }
    const { rows } = await pool.query<{ hold_minutes: number }>(`SELECT hold_minutes FROM orgs WHERE id = $1`, [
      fx.orgA,
    ]);
    expect(rows[0].hold_minutes).toBe(30);
  });

  it('the database refuses a stored length outside 5 to 60, whatever the app sends', async () => {
    for (const value of [4, 0, 61]) {
      await expect(
        withOrg(pool, fx.actor.userId, fx.orgA, db =>
          db.query(`UPDATE orgs SET hold_minutes = $1 WHERE id = $2`, [value, fx.orgA]),
        ),
      ).rejects.toMatchObject({ code: '23514', constraint: 'orgs_hold_minutes_check' });
    }
  });

  it('a staff member cannot change the length: the service refuses (403) and the database changes no row', async () => {
    await setLength(20);
    const refused = await camp.setHoldLength(staff, { holdMinutes: 60 }).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(isHttpError(refused) && refused.statusCode).toBe(403);

    const changed = await withOrg(pool, staff.userId, staff.orgId, db =>
      db.query(`UPDATE orgs SET hold_minutes = 60 WHERE id = $1 RETURNING id`, [fx.orgA]),
    );
    expect(changed.rowCount).toBe(0);

    const { rows } = await pool.query<{ hold_minutes: number }>(`SELECT hold_minutes FROM orgs WHERE id = $1`, [
      fx.orgA,
    ]);
    expect(rows[0].hold_minutes).toBe(20);
  });
});

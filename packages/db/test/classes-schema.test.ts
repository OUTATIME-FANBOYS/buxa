import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import { memberOf } from './support';

const url = process.env.DATABASE_URL;

/** Class, session and enrolment tables. Each one must refuse another organisation's rows, in both directions. */
const TENANT_TABLES = ['classes', 'sessions', 'enrolments'] as const;

interface Seeded {
  person: string;
  classId: string;
  session: string;
  enrolment: string;
}

// These need a real Postgres (DATABASE_URL). CI provides one.
describe.skipIf(!url)('phase 2 schema: isolation, constraints and grants', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let orgA = '';
  let orgB = '';
  let a: Seeded;
  let b: Seeded;
  let ownerA = '';
  let ownerB = '';

  /** One class, a session, a person and an enrolment, all in one organisation. */
  async function seed(org: string, label: string): Promise<Seeded> {
    return withOrg(pool, await memberOf(pool, org), org, async db => {
      const person = (
        await db.query<{ id: string }>(
          `INSERT INTO people (org_id, given_name, family_name, date_of_birth, phone) VALUES ($1, $2, 'Camper', '2012-06-15', '+1 555 0100') RETURNING id`,
          [org, label],
        )
      ).rows[0].id;
      const classId = (
        await db.query<{ id: string }>(
          `INSERT INTO classes (org_id, name, age_min, age_max, default_capacity) VALUES ($1, $2, 8, 12, 10) RETURNING id`,
          [org, `Robotics ${label}`],
        )
      ).rows[0].id;
      const session = (
        await db.query<{ id: string }>(
          `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
         VALUES ($1, $2, '2027-07-05T09:00:00Z', '2027-07-05T12:00:00Z', 'Hall 1', 2, 8, 1) RETURNING id`,
          [org, classId],
        )
      ).rows[0].id;
      const enrolment = (
        await db.query<{ id: string }>(
          `INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled') RETURNING id`,
          [org, session, person],
        )
      ).rows[0].id;

      return { person, classId, session, enrolment };
    });
  }

  beforeAll(async () => {
    await migrate(pool);
    orgA = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Classes A', $1) RETURNING id`, [
        `classes-a-${tag}`,
      ])
    ).rows[0].id;
    orgB = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Classes B', $1) RETURNING id`, [
        `classes-b-${tag}`,
      ])
    ).rows[0].id;
    ownerA = await memberOf(pool, orgA);
    ownerB = await memberOf(pool, orgB);
    a = await seed(orgA, 'Ann');
    b = await seed(orgB, 'Bo');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = ANY($1::uuid[])', [[orgA, orgB]]).catch(() => undefined);
    await pool.end();
  });

  describe('tenant isolation', () => {
    it.each(TENANT_TABLES)('org A sees only its own %s rows', async table => {
      const orgs = await withOrg(pool, ownerA, orgA, async db =>
        (await db.query<{ org_id: string }>(`SELECT DISTINCT org_id FROM ${table}`)).rows.map(r => r.org_id),
      );
      expect(orgs).toEqual([orgA]);
    });

    it.each(TENANT_TABLES)('org B sees only its own %s rows', async table => {
      const orgs = await withOrg(pool, ownerB, orgB, async db =>
        (await db.query<{ org_id: string }>(`SELECT DISTINCT org_id FROM ${table}`)).rows.map(r => r.org_id),
      );
      expect(orgs).toEqual([orgB]);
    });

    it('org A cannot insert rows into org B on any phase 2 table', async () => {
      await expect(
        withOrg(pool, ownerA, orgA, db =>
          db.query(`INSERT INTO classes (org_id, name, default_capacity) VALUES ($1, 'X', 5)`, [orgB]),
        ),
      ).rejects.toThrow(/row-level security/);
      await expect(
        withOrg(pool, ownerA, orgA, db =>
          db.query(
            `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
         VALUES ($1, $2, '2027-07-05T09:00:00Z', '2027-07-05T10:00:00Z', 'X', 1, 1, 1)`,
            [orgB, b.classId],
          ),
        ),
      ).rejects.toThrow(/row-level security/);
      await expect(
        withOrg(pool, ownerA, orgA, db =>
          db.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [
            orgB,
            b.session,
            b.person,
          ]),
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it('org A cannot change or cancel org B rows (they silently match nothing)', async () => {
      const renamed = await withOrg(
        pool,
        ownerA,
        orgA,
        async db => (await db.query(`UPDATE classes SET name = 'hacked' WHERE id = $1`, [b.classId])).rowCount,
      );
      const cancelled = await withOrg(
        pool,
        ownerA,
        orgA,
        async db =>
          (
            await db.query(`UPDATE enrolments SET status = 'cancelled', cancelled_at = now() WHERE id = $1`, [
              b.enrolment,
            ])
          ).rowCount,
      );
      expect(renamed).toBe(0);
      expect(cancelled).toBe(0);
      const name = await withOrg(
        pool,
        ownerB,
        orgB,
        async db =>
          (await db.query<{ name: string }>('SELECT name FROM classes WHERE id = $1', [b.classId])).rows[0].name,
      );
      expect(name).toBe('Robotics Bo');
    });

    it('org A cannot move its own row into org B', async () => {
      await expect(
        withOrg(pool, ownerA, orgA, db => db.query(`UPDATE sessions SET org_id = $1 WHERE id = $2`, [orgB, a.session])),
      ).rejects.toThrow(/row-level security/);
    });

    it('cross-organisation references are refused by composite foreign keys', async () => {
      const fk = (sql: string, params: unknown[]) =>
        expect(withOrg(pool, ownerA, orgA, db => db.query(sql, params))).rejects.toMatchObject({ code: '23503' });
      // A session in A that points at B's class.
      await fk(
        `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
                VALUES ($1, $2, '2027-07-05T09:00:00Z', '2027-07-05T10:00:00Z', 'X', 1, 1, 1)`,
        [orgA, b.classId],
      );
      // An enrolment in A that points at B's session.
      await fk(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [
        orgA,
        b.session,
        a.person,
      ]);
      // An enrolment in A that points at B's person.
      await fk(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [
        orgA,
        a.session,
        b.person,
      ]);
      // Moving A's enrolment onto B's session.
      await fk(`UPDATE enrolments SET session_id = $2 WHERE id = $1`, [a.enrolment, b.session]);
    });
  });

  describe('constraints', () => {
    const asA = <T>(work: (db: pg.PoolClient) => Promise<T>) => withOrg(pool, ownerA, orgA, work);

    it('one active enrolment per person per session', async () => {
      await expect(
        asA(db =>
          db.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'waitlisted')`, [
            orgA,
            a.session,
            a.person,
          ]),
        ),
      ).rejects.toMatchObject({ code: '23505', constraint: 'enrolments_one_active_series_idx' });
    });

    it('a cancelled enrolment does not block a new one for the same session', async () => {
      await asA(db =>
        db.query(`UPDATE enrolments SET status = 'cancelled', cancelled_at = now() WHERE id = $1`, [a.enrolment]),
      );
      await asA(db =>
        db.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [
          orgA,
          a.session,
          a.person,
        ]),
      );
    });

    it('ends_at must be after starts_at', async () => {
      await expect(
        asA(db =>
          db.query(
            `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
         VALUES ($1, $2, '2027-07-05T12:00:00Z', '2027-07-05T09:00:00Z', 'X', 1, 1, 1)`,
            [orgA, a.classId],
          ),
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        asA(db =>
          db.query(
            `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
         VALUES ($1, $2, '2027-07-05T09:00:00Z', '2027-07-05T09:00:00Z', 'X', 1, 1, 1)`,
            [orgA, a.classId],
          ),
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('age_min must not exceed age_max', async () => {
      await expect(
        asA(db =>
          db.query(
            `INSERT INTO classes (org_id, name, age_min, age_max, default_capacity) VALUES ($1, 'X', 12, 8, 5)`,
            [orgA],
          ),
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('capacity and instructor ratios must be positive', async () => {
      await expect(
        asA(db => db.query(`INSERT INTO classes (org_id, name, default_capacity) VALUES ($1, 'X', 0)`, [orgA])),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        asA(db =>
          db.query(
            `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
         VALUES ($1, $2, '2027-07-05T09:00:00Z', '2027-07-05T10:00:00Z', 'X', 1, 0, 1)`,
            [orgA, a.classId],
          ),
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        asA(db =>
          db.query(
            `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
         VALUES ($1, $2, '2027-07-05T09:00:00Z', '2027-07-05T10:00:00Z', 'X', 1, 1, 0)`,
            [orgA, a.classId],
          ),
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('enrolment status is one of the three known values', async () => {
      await expect(
        asA(db =>
          db.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'paid')`, [
            orgA,
            a.session,
            a.person,
          ]),
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('cancelled_at is set exactly when the enrolment is cancelled', async () => {
      // The live enrolment for a.person in a.session (re-created by the test above) is still 'enrolled'.
      const live = `(SELECT id FROM enrolments WHERE session_id = $1 AND person_id = $2 AND status = 'enrolled')`;
      await expect(
        asA(db => db.query(`UPDATE enrolments SET status = 'cancelled' WHERE id = ${live}`, [a.session, a.person])),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        asA(db => db.query(`UPDATE enrolments SET cancelled_at = now() WHERE id = ${live}`, [a.session, a.person])),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('an override is recorded only with its reason', async () => {
      await expect(
        asA(db =>
          db.query(
            `INSERT INTO enrolments (org_id, session_id, person_id, status, overridden) VALUES ($1, $2, $3, 'enrolled', true)`,
            [orgA, a.session, a.person],
          ),
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        asA(db =>
          db.query(
            `INSERT INTO enrolments (org_id, session_id, person_id, status, overridden, override_reason)
         VALUES ($1, $2, $3, 'enrolled', true, '   ')`,
            [orgA, a.session, a.person],
          ),
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('capacity is a hard limit at the database too (trigger)', async () => {
      // Session a has capacity 2. Its enrolled count is now 1 (Ann re-enrolled above), so one more fits and a third does not.
      const other = await asA(db =>
        db.query<{ id: string }>(
          `INSERT INTO people (org_id, given_name, family_name, date_of_birth, phone) VALUES ($1, 'Second', 'Camper', '2012-06-15', '+1 555 0100') RETURNING id`,
          [orgA],
        ),
      );
      const third = await asA(db =>
        db.query<{ id: string }>(
          `INSERT INTO people (org_id, given_name, family_name, date_of_birth, phone) VALUES ($1, 'Third', 'Camper', '2012-06-15', '+1 555 0100') RETURNING id`,
          [orgA],
        ),
      );
      await asA(db =>
        db.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [
          orgA,
          a.session,
          other.rows[0].id,
        ]),
      );
      await expect(
        asA(db =>
          db.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [
            orgA,
            a.session,
            third.rows[0].id,
          ]),
        ),
      ).rejects.toMatchObject({ code: '23514', constraint: 'enrolments_capacity' });
      // A waitlisted row does not take a place.
      await asA(db =>
        db.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'waitlisted')`, [
          orgA,
          a.session,
          third.rows[0].id,
        ]),
      );
    });

    it('lowering capacity below the number enrolled is refused', async () => {
      await expect(
        asA(db => db.query(`UPDATE sessions SET capacity = 1 WHERE id = $1`, [a.session])),
      ).rejects.toMatchObject({ code: '23514', constraint: 'sessions_capacity_floor' });
    });
  });

  describe('forced row-level security and grants', () => {
    it.each(TENANT_TABLES)('RLS is enabled and forced on %s', async table => {
      const r = await pool.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1`,
        [table],
      );
      expect(r.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    });

    it.each(TENANT_TABLES)('buxa_app has no DELETE on %s', async table => {
      const r = await pool.query<{ can: boolean }>(`SELECT has_table_privilege('buxa_app', $1, 'DELETE') AS can`, [
        table,
      ]);
      expect(r.rows[0].can).toBe(false);
    });
  });
});

import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';

const url = process.env.DATABASE_URL;

/** Tables added in phase 1. Each one must refuse another organisation's rows, in both directions. */
const TENANT_TABLES = ['people', 'person_roles', 'households', 'household_members', 'memberships', 'credentials', 'check_ins'] as const;

interface Seeded {
  person: string;
  guardian: string;
  household: string;
  membership: string;
  credential: string;
  checkIn: string;
}

// These need a real Postgres (DATABASE_URL). CI provides one.
describe.skipIf(!url)('phase 1 schema: isolation, constraints and grants', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let orgA = '';
  let orgB = '';
  let userA = '';
  let userB = '';
  let a: Seeded;
  let b: Seeded;

  /** One person, a guardian, a household, a membership, a badge and an open check-in, all in one organisation. */
  async function seed(org: string, user: string, label: string): Promise<Seeded> {
    return withOrg(pool, org, async db => {
      const person = (await db.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name) VALUES ($1, $2, 'Test') RETURNING id`, [org, label])).rows[0].id;
      const guardian = (await db.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name) VALUES ($1, 'Guardian', $2) RETURNING id`, [org, label])).rows[0].id;
      await db.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'camper')`, [org, person]);
      await db.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'guardian')`, [org, guardian]);
      const household = (await db.query<{ id: string }>(`INSERT INTO households (org_id, name) VALUES ($1, 'Home') RETURNING id`, [org])).rows[0].id;
      await db.query(
        `INSERT INTO household_members (org_id, household_id, person_id, relationship, is_guardian, can_pickup)
         VALUES ($1, $2, $3, 'parent', true, true)`, [org, household, guardian]);
      await db.query(
        `INSERT INTO household_members (org_id, household_id, person_id, relationship) VALUES ($1, $2, $3, 'child')`, [org, household, person]);
      const membership = (await db.query<{ id: string }>(
        `INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on) VALUES ($1, $2, 'Summer 2027', '2027-06-01', '2027-08-31') RETURNING id`,
        [org, person])).rows[0].id;
      const credential = (await db.query<{ id: string }>(
        'INSERT INTO credentials (org_id, person_id, token_hash) VALUES ($1, $2, $3) RETURNING id',
        [org, person, createHash('sha256').update(label).digest()])).rows[0].id;
      const checkIn = (await db.query<{ id: string }>(
        `INSERT INTO check_ins (org_id, person_id, checked_in_at, checked_in_by, method)
         VALUES ($1, $2, '2027-07-01T09:00:00Z', $3, 'qr') RETURNING id`, [org, person, user])).rows[0].id;
      return { person, guardian, household, membership, credential, checkIn };
    });
  }

  beforeAll(async () => {
    await migrate(pool);
    orgA = (await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Schema A', $1) RETURNING id`, [`schema-a-${tag}`])).rows[0].id;
    orgB = (await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Schema B', $1) RETURNING id`, [`schema-b-${tag}`])).rows[0].id;
    userA = (await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'A') RETURNING id`, [`a-${tag}@example.test`])).rows[0].id;
    userB = (await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'B') RETURNING id`, [`b-${tag}@example.test`])).rows[0].id;
    a = await seed(orgA, userA, 'Ann');
    b = await seed(orgB, userB, 'Bo');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = ANY($1::uuid[])', [[orgA, orgB]]).catch(() => undefined);
    await pool.end();
  });

  describe('tenant isolation', () => {
    it.each(TENANT_TABLES)('org A sees only its own %s rows', async table => {
      const orgs = await withOrg(pool, orgA, async db => (await db.query<{ org_id: string }>(`SELECT DISTINCT org_id FROM ${table}`)).rows.map(r => r.org_id));
      expect(orgs).toEqual([orgA]);
    });

    it('org A cannot insert into org B on any tenant table', async () => {
      await expect(withOrg(pool, orgA, db => db.query(`INSERT INTO people (org_id, given_name, family_name) VALUES ($1, 'X', 'Y')`, [orgB])))
        .rejects.toThrow(/row-level security/);
      await expect(withOrg(pool, orgA, db => db.query(`INSERT INTO households (org_id, name) VALUES ($1, 'X')`, [orgB])))
        .rejects.toThrow(/row-level security/);
      await expect(withOrg(pool, orgA, db => db.query(
        `INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on) VALUES ($1, $2, 'X', '2027-01-01', '2027-01-02')`, [orgB, a.person])))
        .rejects.toThrow(/row-level security/);
      await expect(withOrg(pool, orgA, db => db.query(
        `INSERT INTO check_ins (org_id, person_id, checked_in_at, method) VALUES ($1, $2, now(), 'qr')`, [orgB, a.person])))
        .rejects.toThrow(/row-level security/);
      await expect(withOrg(pool, orgA, db => db.query(
        `INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'camper')`, [orgB, a.person])))
        .rejects.toThrow(/row-level security/);
    });

    it('org A cannot change or unlink org B rows (they silently match nothing)', async () => {
      const changed = await withOrg(pool, orgA, async db => (await db.query(`UPDATE people SET given_name = 'hacked' WHERE id = $1`, [b.person])).rowCount);
      const removed = await withOrg(pool, orgA, async db => (await db.query('DELETE FROM person_roles WHERE person_id = $1', [b.person])).rowCount);
      expect(changed).toBe(0);
      expect(removed).toBe(0);
      const name = await withOrg(pool, orgB, async db => (await db.query<{ given_name: string }>('SELECT given_name FROM people WHERE id = $1', [b.person])).rows[0].given_name);
      expect(name).toBe('Bo');
    });

    it('org A cannot move its own row into org B', async () => {
      await expect(withOrg(pool, orgA, db => db.query(`UPDATE people SET org_id = $1 WHERE id = $2`, [orgB, a.person])))
        .rejects.toThrow(/row-level security/);
    });

    it('cross-organisation references are refused by composite foreign keys', async () => {
      const fk = (sql: string, params: unknown[]) => expect(withOrg(pool, orgA, db => db.query(sql, params))).rejects.toMatchObject({ code: '23503' });
      await fk(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'instructor')`, [orgA, b.person]);
      await fk(`INSERT INTO household_members (org_id, household_id, person_id, relationship) VALUES ($1, $2, $3, 'x')`, [orgA, a.household, b.person]);
      await fk(`INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on) VALUES ($1, $2, 'X', '2027-01-01', '2027-01-02')`, [orgA, b.person]);
      // B's guardian has no badge and no open visit, so only the foreign key can refuse these.
      await fk(`INSERT INTO credentials (org_id, person_id, token_hash) VALUES ($1, $2, $3)`, [orgA, b.guardian, Buffer.alloc(32, 7)]);
      await fk(`INSERT INTO check_ins (org_id, person_id, checked_in_at, method) VALUES ($1, $2, now(), 'qr')`, [orgA, b.guardian]);
      await fk(`UPDATE check_ins SET checked_out_at = '2027-07-01T10:00:00Z', collected_by_person_id = $2 WHERE id = $1`, [a.checkIn, b.person]);
    });
  });

  describe('constraints', () => {
    const asA = <T>(work: (db: pg.PoolClient) => Promise<T>) => withOrg(pool, orgA, work);

    it('one open check-in per person (the partial unique index)', async () => {
      await expect(asA(db => db.query(
        `INSERT INTO check_ins (org_id, person_id, checked_in_at, method) VALUES ($1, $2, now(), 'search')`, [orgA, a.person])))
        .rejects.toMatchObject({ code: '23505', constraint: 'check_ins_one_open_idx' });
    });

    it('a closed visit does not block a new open one', async () => {
      await asA(db => db.query(
        `INSERT INTO check_ins (org_id, person_id, checked_in_at, checked_out_at, method)
         VALUES ($1, $2, '2027-06-30T09:00:00Z', '2027-06-30T10:00:00Z', 'qr')`, [orgA, a.person]));
      expect((await asA(db => db.query('SELECT 1 FROM check_ins WHERE person_id = $1', [a.person]))).rowCount).toBeGreaterThan(1);
    });

    it('check-out must not be before check-in', async () => {
      await expect(asA(db => db.query(
        `INSERT INTO check_ins (org_id, person_id, checked_in_at, checked_out_at, method)
         VALUES ($1, $2, '2027-06-30T10:00:00Z', '2027-06-30T09:00:00Z', 'qr')`, [orgA, a.person]))).rejects.toMatchObject({ code: '23514' });
      await expect(asA(db => db.query(`UPDATE check_ins SET checked_out_at = '2027-06-01T00:00:00Z' WHERE id = $1`, [a.checkIn])))
        .rejects.toMatchObject({ code: '23514' });
    });

    it('checked-out-by and collected-by need a check-out time', async () => {
      await expect(asA(db => db.query(`UPDATE check_ins SET checked_out_by = $2 WHERE id = $1`, [a.checkIn, userA])))
        .rejects.toMatchObject({ code: '23514' });
    });

    it('one active badge per person; a revoked badge frees the slot', async () => {
      const hash = Buffer.alloc(32, 9);
      await expect(asA(db => db.query('INSERT INTO credentials (org_id, person_id, token_hash) VALUES ($1, $2, $3)', [orgA, a.person, hash])))
        .rejects.toMatchObject({ code: '23505', constraint: 'credentials_one_active_idx' });
      await asA(db => db.query('UPDATE credentials SET revoked_at = now() WHERE id = $1', [a.credential]));
      await asA(db => db.query('INSERT INTO credentials (org_id, person_id, token_hash) VALUES ($1, $2, $3)', [orgA, a.person, hash]));
    });

    it('a badge hash is exactly 32 bytes', async () => {
      await expect(asA(db => db.query('INSERT INTO credentials (org_id, person_id, token_hash) VALUES ($1, $2, $3)', [orgA, a.guardian, Buffer.alloc(16)])))
        .rejects.toMatchObject({ code: '23514' });
    });

    it('ends_on must not be before starts_on', async () => {
      await expect(asA(db => db.query(
        `INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on) VALUES ($1, $2, 'X', '2027-08-31', '2027-06-01')`, [orgA, a.person])))
        .rejects.toMatchObject({ code: '23514' });
    });

    it('a membership is revoked with both a time and a reason, or neither', async () => {
      await expect(asA(db => db.query(
        `INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on, revoked_at)
         VALUES ($1, $2, 'X', '2027-06-01', '2027-08-31', now())`, [orgA, a.person]))).rejects.toMatchObject({ code: '23514' });
      await expect(asA(db => db.query(
        `INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on, revoked_reason)
         VALUES ($1, $2, 'X', '2027-06-01', '2027-08-31', 'Unpaid')`, [orgA, a.person]))).rejects.toMatchObject({ code: '23514' });
      await asA(db => db.query(
        `INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on, revoked_at, revoked_reason)
         VALUES ($1, $2, 'X', '2027-06-01', '2027-08-31', now(), 'Unpaid')`, [orgA, a.person]));
    });

    it('only a guardian can be authorised to collect a child', async () => {
      await expect(asA(db => db.query(
        `INSERT INTO household_members (org_id, household_id, person_id, relationship, is_guardian, can_pickup)
         VALUES ($1, $2, $3, 'friend', false, true)`, [orgA, a.household, a.guardian]))).rejects.toMatchObject({ code: '23514' });
    });

    it('names and roles are checked', async () => {
      await expect(asA(db => db.query(`INSERT INTO people (org_id, given_name, family_name) VALUES ($1, '  ', 'Y')`, [orgA])))
        .rejects.toMatchObject({ code: '23514' });
      await expect(asA(db => db.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'boss')`, [orgA, a.person])))
        .rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('grants: nothing is hard-deleted by request code', () => {
    it.each(['people', 'memberships', 'credentials', 'check_ins', 'households'])('buxa_app has no DELETE on %s', async table => {
      const r = await pool.query<{ can: boolean }>(`SELECT has_table_privilege('buxa_app', $1, 'DELETE') AS can`, [table]);
      expect(r.rows[0].can).toBe(false);
    });

    const NO_DELETE = ['people', 'memberships', 'credentials', 'check_ins', 'households'] as const;
    const ownRow: Record<(typeof NO_DELETE)[number], () => string> = {
      people: () => a.person,
      memberships: () => a.membership,
      credentials: () => a.credential,
      check_ins: () => a.checkIn,
      households: () => a.household,
    };
    it.each(NO_DELETE)('a DELETE on %s is refused, even for its own rows', async table => {
      await expect(asDelete(table, ownRow[table]())).rejects.toThrow(/permission denied/);
    });

    it('link tables may delete (a household member can be removed)', async () => {
      const r = await pool.query<{ can: boolean }>(`SELECT has_table_privilege('buxa_app', 'household_members', 'DELETE') AS can`);
      expect(r.rows[0].can).toBe(true);
    });

    async function asDelete(table: string, id: string): Promise<unknown> {
      return withOrg(pool, orgA, db => db.query(`DELETE FROM ${table} WHERE id = $1`, [id]));
    }
  });

  describe('unaccent name search', () => {
    it('folds accents and case in SQL, as normalizeForSearch does in the domain', async () => {
      const folded = await withOrg(pool, orgA, async db => (await db.query<{ v: string }>(`SELECT unaccent(lower('José García')) AS v`)).rows[0].v);
      expect(folded).toBe('jose garcia');
    });

    it('finds a person by an unaccented word in the joined name', async () => {
      const id = (await withOrg(pool, orgA, db => db.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name, preferred_name) VALUES ($1, 'José', 'García', 'Pepe') RETURNING id`, [orgA]))).rows[0].id;
      const found = await withOrg(pool, orgA, async db => (await db.query<{ id: string }>(
        `SELECT id FROM people WHERE strpos(unaccent(lower(concat_ws(' ', given_name, family_name, preferred_name))), 'jose') > 0`)).rows.map(r => r.id));
      expect(found).toContain(id);
    });
  });
});

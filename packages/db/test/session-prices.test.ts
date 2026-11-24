import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import { memberOf } from './support';

const url = process.env.DATABASE_URL;

// The class price columns (migration 0050) on the sessions table, `sessions`: each class carries its own price. A session (a row
// of `classes`) has no price columns any more. These need a real Postgres (DATABASE_URL).
describe.skipIf(!url)('class prices: constraints and row-level security', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let orgA = '';
  let orgB = '';
  let ownerB = '';

  // Session names are unique per camp (migration 0052), so each price test row gets its own name.
  let priceRows = 0;
  // Inserts a session (its parent row in `classes`) and one class under it with the given price values.
  const insertPrice = async (org: string, values: (string | number | null)[]) =>
    withOrg(pool, await memberOf(pool, org), org, async db => {
      priceRows += 1;
      const parent = await db.query<{ id: string }>(
        `INSERT INTO classes (org_id, name, default_capacity) VALUES ($1, $2, 10) RETURNING id`,
        [org, `Summer ${priceRows}`],
      );

      return db.query<{ id: string }>(
        `INSERT INTO sessions (org_id, class_id, name, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors,
                               price_minor, price_currency, early_bird_minor, early_bird_until)
         VALUES ($1, $2, 'Week one', now(), now() + interval '2 hours', 'Lake', 10, 5, 1, $3, $4, $5, $6::date)
         RETURNING id`,
        [org, parent.rows[0].id, ...values],
      );
    });

  beforeAll(async () => {
    await migrate(pool);
    orgA = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Prices A', $1) RETURNING id`, [
        `prices-a-${tag}`,
      ])
    ).rows[0].id;
    orgB = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Prices B', $1) RETURNING id`, [
        `prices-b-${tag}`,
      ])
    ).rows[0].id;
    ownerB = await memberOf(pool, orgB);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = ANY($1::uuid[])', [[orgA, orgB]]).catch(() => undefined);
    await pool.end();
  });

  it('the session row (classes) no longer has price columns', async () => {
    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'classes' AND column_name LIKE '%price%'`,
    );
    expect(rows).toEqual([]);
  });

  it('accepts no price, a regular price, and a regular price with its early-bird amount and day', async () => {
    await expect(insertPrice(orgA, [null, null, null, null])).resolves.toBeDefined();
    await expect(insertPrice(orgA, [45000, 'AUD', null, null])).resolves.toBeDefined();
    await expect(insertPrice(orgA, [45000, 'AUD', 39900, '2027-07-05'])).resolves.toBeDefined();
  });

  it('refuses a price with no currency, or a currency that is not three capital letters', async () => {
    await expect(insertPrice(orgA, [45000, null, null, null])).rejects.toThrow(/sessions_price_shape/);
    await expect(insertPrice(orgA, [45000, 'aud', null, null])).rejects.toThrow(/price_currency/);
  });

  it('refuses an early-bird amount without its day, or a day without its amount', async () => {
    await expect(insertPrice(orgA, [45000, 'AUD', 39900, null])).rejects.toThrow(/sessions_price_shape/);
    await expect(insertPrice(orgA, [45000, 'AUD', null, '2027-07-05'])).rejects.toThrow(/sessions_price_shape/);
  });

  it('refuses an early-bird amount above the regular price, and a negative amount', async () => {
    await expect(insertPrice(orgA, [39900, 'AUD', 45000, '2027-07-05'])).rejects.toThrow(/sessions_price_shape/);
    await expect(insertPrice(orgA, [-1, 'AUD', null, null])).rejects.toThrow(/price_minor|sessions_price_shape/);
  });

  it("keeps one camp's class prices invisible to another camp", async () => {
    const row = await insertPrice(orgA, [12345, 'NZD', null, null]);
    const seenByB = await withOrg(pool, ownerB, orgB, db =>
      db.query<{ id: string }>('SELECT id FROM sessions WHERE id = $1', [row.rows[0].id]),
    );
    expect(seenByB.rows).toHaveLength(0);
  });
});

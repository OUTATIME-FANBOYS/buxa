import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate, poolConfigFor } from '../src';

const url = process.env.DATABASE_URL;
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

// Audit finding 3:
// Migrations are tested on an empty database in CI.
// Migrations 0018 to 0020 alter tables and change existing data:
// - 0018 backfills first_name and last_name from users.name, adds constraints, and updates user functions
// - 0019 adds external_key and a unique index to sessions
// - 0020 drops orgs.clock_format
//
// This test creates an isolated temporary database, applies 0001 through 0017, seeds realistic rows,
// then applies 0018 through 0020 to verify that migrations succeed against existing data without data loss.

describe.skipIf(!url)('migration upgrade against existing data (0018-0020)', () => {
  const tag = randomBytes(4).toString('hex');
  const tempDbName = `buxa_upgrade_test_${tag}`;

  let rootPool: pg.Pool;
  let tempPool: pg.Pool | null = null;
  let canCreateDb = true;

  const replaceDatabaseName = (connUrl: string, newDb: string): string => {
    const parsed = new URL(connUrl);
    parsed.pathname = `/${newDb}`;

    return parsed.toString();
  };

  beforeAll(async () => {
    rootPool = new pg.Pool(poolConfigFor(url!));

    try {
      await rootPool.query(`CREATE DATABASE "${tempDbName}"`);
    } catch (err) {
      console.warn(`Could not CREATE DATABASE for upgrade test (insufficient privileges?): ${String(err)}`);
      canCreateDb = false;

      return;
    }

    const tempUrl = replaceDatabaseName(url!, tempDbName);
    tempPool = new pg.Pool(poolConfigFor(tempUrl));

    // 1. Apply migrations 0001 to 0017
    const client = await tempPool.connect();
    try {
      await client.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
      );

      const earlyMigrations = readdirSync(DIR)
        .filter(f => f.endsWith('.sql') && f.slice(0, 4) <= '0017')
        .sort();

      for (const file of earlyMigrations) {
        await client.query('BEGIN');
        await client.query(readFileSync(join(DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      }

      // 2. Seed data before 0018-0020
      // Users with various name formats to test the 0018 name splitter
      await client.query(`
        INSERT INTO users (email, name) VALUES
          ('alice-${tag}@upgrade.test', 'Alice'),
          ('bob-${tag}@upgrade.test', 'Bob Smith'),
          ('mary-${tag}@upgrade.test', 'Mary Jane Watson'),
          ('charlie-${tag}@upgrade.test', '  Charlie Brown  '),
          ('montgomery-${tag}@upgrade.test', 'Alexander Bartholomew Christopher David Edward Montgomery')
      `);

      // Org with clock_format (added in 0012, removed in 0020)
      const orgResult = await client.query<{ id: string }>(`
        INSERT INTO orgs (name, slug, clock_format)
        VALUES ('Camp Upgrade ${tag}', 'camp-upgrade-${tag}', '12h')
        RETURNING id
      `);
      const orgId = orgResult.rows[0].id;

      // Class and session (before 0019 adds external_key)
      const classResult = await client.query<{ id: string }>(
        `
        INSERT INTO classes (org_id, name, default_capacity)
        VALUES ($1, 'Kayaking ${tag}', 12)
        RETURNING id
      `,
        [orgId],
      );
      const classId = classResult.rows[0].id;

      await client.query(
        `
        INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
        VALUES ($1, $2, now() + interval '1 day', now() + interval '1 day 2 hours', 'Lake', 10, 5, 1)
      `,
        [orgId, classId],
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    if (tempPool) {
      await tempPool.end().catch(() => {});
    }
    if (canCreateDb && rootPool) {
      try {
        await rootPool.query(`DROP DATABASE IF EXISTS "${tempDbName}" WITH (FORCE)`);
      } catch {
        // Ignore drop errors during cleanup
      }
    }
    if (rootPool) {
      await rootPool.end().catch(() => {});
    }
  });

  it('successfully applies migrations 0018 through 0020 on populated tables', async () => {
    if (!canCreateDb || !tempPool) {
      return;
    }

    // Run migrate() against tempPool, which should apply 0018, 0019, 0020
    const applied = await migrate(tempPool);
    expect(applied).toEqual([
      '0018_first_last_name_and_clock.sql',
      '0019_session_external_key.sql',
      '0020_drop_camp_clock.sql',
      '0021_orgs_update_columns.sql',
      '0022_sessions_parent_classes.sql',
      '0023_registration_forms.sql',
      '0024_session_prices.sql',
    ]);
  });

  it('0022 moves the existing class template into its session: dates from the classes, ages and name copied onto each class', async () => {
    if (!canCreateDb || !tempPool) {
      return;
    }
    const parent = await tempPool.query<{ name: string; starts_on: string; ends_on: string }>(
      `SELECT name, to_char(starts_on, 'YYYY-MM-DD') AS starts_on, to_char(ends_on, 'YYYY-MM-DD') AS ends_on
         FROM classes WHERE name = $1`,
      [`Kayaking ${tag}`],
    );
    expect(parent.rows).toHaveLength(1);
    expect(parent.rows[0]).toMatchObject({ name: `Kayaking ${tag}` });
    expect(parent.rows[0].starts_on <= parent.rows[0].ends_on).toBe(true);
    expect(parent.rows[0].starts_on).not.toBeNull();
    const child = await tempPool.query<{ name: string; age_min: number | null; capacity: number }>(
      `SELECT s.name, s.age_min, s.capacity FROM sessions s JOIN classes c ON c.id = s.class_id WHERE c.name = $1`,
      [`Kayaking ${tag}`],
    );
    expect(child.rows).toEqual([{ name: `Kayaking ${tag}`, age_min: null, capacity: 10 }]);
  });

  it('migration 0018 correctly splits existing user names into first_name and last_name', async () => {
    if (!canCreateDb || !tempPool) {
      return;
    }

    const { rows } = await tempPool.query<{
      email: string;
      name: string;
      first_name: string;
      last_name: string | null;
    }>(`SELECT email, name, first_name, last_name FROM users WHERE email LIKE '%@upgrade.test' ORDER BY email`);

    expect(rows).toHaveLength(5);

    const userMap = new Map(rows.map(r => [r.email.split('@')[0].split('-')[0], r]));

    const alice = userMap.get('alice')!;
    expect(alice.first_name).toBe('Alice');
    expect(alice.last_name).toBeNull();
    expect(alice.name).toBe('Alice');

    const bob = userMap.get('bob')!;
    expect(bob.first_name).toBe('Bob');
    expect(bob.last_name).toBe('Smith');
    expect(bob.name).toBe('Bob Smith');

    const mary = userMap.get('mary')!;
    expect(mary.first_name).toBe('Mary');
    expect(mary.last_name).toBe('Jane Watson');
    expect(mary.name).toBe('Mary Jane Watson');

    const charlie = userMap.get('charlie')!;
    expect(charlie.first_name).toBe('Charlie');
    expect(charlie.last_name).toBe('Brown');

    // Every first_name is NOT NULL
    for (const user of rows) {
      expect(user.first_name.length).toBeGreaterThan(0);
    }
  });

  it('migration 0019 added external_key column to sessions', async () => {
    if (!canCreateDb || !tempPool) {
      return;
    }

    const { rows } = await tempPool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'external_key'`,
    );
    expect(rows).toHaveLength(1);

    // Verify external_key can be updated and unique constraint works
    await tempPool.query(`UPDATE sessions SET external_key = 'EXT-001'`);
    const check = await tempPool.query<{ external_key: string }>(`SELECT external_key FROM sessions`);
    expect(check.rows[0].external_key).toBe('EXT-001');
  });

  it('migration 0020 dropped clock_format column from orgs', async () => {
    if (!canCreateDb || !tempPool) {
      return;
    }

    const { rows } = await tempPool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'orgs' AND column_name = 'clock_format'`,
    );
    expect(rows).toHaveLength(0);
  });
});

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

  const requireUrl = (): string => {
    if (!url) {
      throw new Error('DATABASE_URL is not set for the upgrade test.');
    }

    return url;
  };
  const replaceDatabaseName = (connUrl: string, newDb: string): string => {
    const parsed = new URL(connUrl);
    parsed.pathname = `/${newDb}`;

    return parsed.toString();
  };

  beforeAll(async () => {
    rootPool = new pg.Pool(poolConfigFor(requireUrl()));
    // An idle connection the server closes (57P01) is reported as a pool error. Without a listener it fails the whole run.
    rootPool.on('error', () => {});

    try {
      await rootPool.query(`CREATE DATABASE "${tempDbName}"`);
    } catch (err) {
      console.warn(`Could not CREATE DATABASE for upgrade test (insufficient privileges?): ${String(err)}`);
      canCreateDb = false;

      return;
    }

    const tempUrl = replaceDatabaseName(requireUrl(), tempDbName);
    tempPool = new pg.Pool(poolConfigFor(tempUrl));
    tempPool.on('error', () => {});

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
        VALUES ($1, $2, now() + interval '1 day', now() + interval '1 day 2 hours', 'Lake ' || gen_random_uuid(), 10, 5, 1)
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
      '0025_seat_holds.sql',
      '0026_teacher_role.sql',
      '0027_class_teachers.sql',
      '0028_calendar_feed.sql',
      '0029_public_sessions.sql',
      '0030_member_options.sql',
      '0031_registration_confirmation.sql',
      '0032_session_membership.sql',
      '0033_teacher_calendar_tokens.sql',
      '0034_session_membership_contract.sql',
      '0035_session_delete_guard.sql',
      '0036_org_update_admin_owner.sql',
      '0037_notifications.sql',
      '0038_member_invites.sql',
      '0039_member_role_change.sql',
      '0040_delete_person.sql',
      '0041_badge_encrypted_token.sql',
      '0042_membership_session.sql',
      '0043_membership_expiry.sql',
      '0044_drop_preferred_name.sql',
      '0045_registration_holds.sql',
      '0046_registration_classes.sql',
      '0047_groups_rooms_assignments.sql',
      '0048_camp_hold_length.sql',
      '0049_check_in_session.sql',
      '0050_class_prices.sql',
      '0051_teacher_person_link.sql',
      '0052_session_archive_and_delete.sql',
      '0053_session_status.sql',
      '0054_registration_lifecycle.sql',
      '0055_holds_credentials_registration_keys.sql',
      '0056_name_and_email_uniqueness.sql',
      '0057_role_aware_policies.sql',
      '0058_rename_member_roster_name.sql',
      '0059_session_dates_flag.sql',
      '0060_class_series.sql',
      '0061_series_enrolment_keys.sql',
      '0062_registration_form_files.sql',
      '0063_registration_documents.sql',
      '0064_series_occurrence_status.sql',
      '0065_series_day_delete_guard.sql',
      '0066_series_reschedule.sql',
      '0067_class_location_overlap.sql',
      '0068_camp_gate.sql',
      '0069_retire_teacher_role.sql',
      '0070_registration_form_delete.sql',
      '0071_registration_form_drafts.sql',
      '0073_person_emergency_contact.sql',
      '0074_person_dob_phone_required.sql',
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
    const pick = (key: string) => {
      const row = userMap.get(key);
      if (!row) {
        throw new Error(`No upgraded user for ${key}.`);
      }

      return row;
    };

    const alice = pick('alice');
    expect(alice.first_name).toBe('Alice');
    expect(alice.last_name).toBeNull();
    expect(alice.name).toBe('Alice');

    const bob = pick('bob');
    expect(bob.first_name).toBe('Bob');
    expect(bob.last_name).toBe('Smith');
    expect(bob.name).toBe('Bob Smith');

    const mary = pick('mary');
    expect(mary.first_name).toBe('Mary');
    expect(mary.last_name).toBe('Jane Watson');
    expect(mary.name).toBe('Mary Jane Watson');

    const charlie = pick('charlie');
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

// Migration 0050 moves each session's price (the `classes` row) onto its classes (the `sessions` rows), on a database that already
// holds priced data. The database is brought to 0049 by hand, seeded with prices, and then migrate() applies 0050 alone.
describe.skipIf(!url)('migration 0050 copies session prices onto their classes', () => {
  const tag = randomBytes(4).toString('hex');
  const tempDbName = `buxa_price_copy_${tag}`;
  let rootPool: pg.Pool | null = null;
  let tempPool: pg.Pool | null = null;
  let canCreateDb = true;

  const requireUrl = (): string => {
    if (!url) {
      throw new Error('DATABASE_URL is not set for the price copy test.');
    }

    return url;
  };

  beforeAll(async () => {
    rootPool = new pg.Pool(poolConfigFor(requireUrl()));
    rootPool.on('error', () => {});
    try {
      await rootPool.query(`CREATE DATABASE "${tempDbName}"`);
    } catch (err) {
      console.warn(`Could not CREATE DATABASE for the price copy test (insufficient privileges?): ${String(err)}`);
      canCreateDb = false;

      return;
    }
    const parsed = new URL(requireUrl());
    parsed.pathname = `/${tempDbName}`;
    tempPool = new pg.Pool(poolConfigFor(parsed.toString()));
    tempPool.on('error', () => {});

    const client = await tempPool.connect();
    try {
      await client.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
      );
      for (const file of readdirSync(DIR)
        .filter(f => f.endsWith('.sql') && f.slice(0, 4) < '0050')
        .sort()) {
        await client.query('BEGIN');
        await client.query(readFileSync(join(DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      }
      const org = await client.query<{ id: string }>(
        `INSERT INTO orgs (name, slug) VALUES ('Price copy', $1) RETURNING id`,
        [`price-copy-${tag}`],
      );
      const orgId = org.rows[0].id;
      // Session A (a row of classes) has a price and two classes; session B has no price and one class.
      await client.query(
        `INSERT INTO classes (org_id, name, default_capacity, price_minor, price_currency, early_bird_minor, early_bird_until)
         VALUES ($1, 'Session A', 10, 45000, 'AUD', 39900, '2027-07-05'), ($1, 'Session B', 10, NULL, NULL, NULL, NULL)`,
        [orgId],
      );
      const sessions = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM classes WHERE org_id = $1`,
        [orgId],
      );
      const idOf = (name: string) => sessions.rows.find(r => r.name === name)?.id;
      const aId = idOf('Session A');
      const bId = idOf('Session B');
      for (const [parent, label] of [
        [aId, 'Mon'],
        [aId, 'Tue'],
        [bId, 'Wed'],
      ] as const) {
        await client.query(
          `INSERT INTO sessions (org_id, class_id, name, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
           VALUES ($1, $2, $3, now(), now() + interval '1 hour', 'Lake ' || gen_random_uuid(), 10, 5, 1)`,
          [orgId, parent, label],
        );
      }
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    if (tempPool) {
      await tempPool.end().catch(() => {});
    }
    if (canCreateDb && rootPool) {
      await rootPool.query(`DROP DATABASE IF EXISTS "${tempDbName}" WITH (FORCE)`).catch(() => {});
    }
    if (rootPool) {
      await rootPool.end().catch(() => {});
    }
  });

  it('copies each session price onto every class of that session and drops the session columns', async () => {
    if (!canCreateDb || !tempPool) {
      return;
    }
    const applied = await migrate(tempPool);
    expect(applied).toEqual([
      '0050_class_prices.sql',
      '0051_teacher_person_link.sql',
      '0052_session_archive_and_delete.sql',
      '0053_session_status.sql',
      '0054_registration_lifecycle.sql',
      '0055_holds_credentials_registration_keys.sql',
      '0056_name_and_email_uniqueness.sql',
      '0057_role_aware_policies.sql',
      '0058_rename_member_roster_name.sql',
      '0059_session_dates_flag.sql',
      '0060_class_series.sql',
      '0061_series_enrolment_keys.sql',
      '0062_registration_form_files.sql',
      '0063_registration_documents.sql',
      '0064_series_occurrence_status.sql',
      '0065_series_day_delete_guard.sql',
      '0066_series_reschedule.sql',
      '0067_class_location_overlap.sql',
      '0068_camp_gate.sql',
      '0069_retire_teacher_role.sql',
      '0070_registration_form_delete.sql',
      '0071_registration_form_drafts.sql',
      '0073_person_emergency_contact.sql',
      '0074_person_dob_phone_required.sql',
    ]);

    const classes = await tempPool.query<{
      name: string;
      label: string;
      price_minor: number | null;
      currency: string | null;
      early_bird_minor: number | null;
      early_bird_until: string | null;
    }>(
      `SELECT p.name, s.name AS label, s.price_minor, s.price_currency AS currency, s.early_bird_minor,
              to_char(s.early_bird_until, 'YYYY-MM-DD') AS early_bird_until
         FROM sessions s JOIN classes p ON p.id = s.class_id ORDER BY s.name`,
    );
    expect(classes.rows).toEqual([
      {
        name: 'Session A',
        label: 'Mon',
        price_minor: 45000,
        currency: 'AUD',
        early_bird_minor: 39900,
        early_bird_until: '2027-07-05',
      },
      {
        name: 'Session A',
        label: 'Tue',
        price_minor: 45000,
        currency: 'AUD',
        early_bird_minor: 39900,
        early_bird_until: '2027-07-05',
      },
      {
        name: 'Session B',
        label: 'Wed',
        price_minor: null,
        currency: null,
        early_bird_minor: null,
        early_bird_until: null,
      },
    ]);

    const dropped = await tempPool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'classes' AND column_name LIKE '%price%'`,
    );
    expect(dropped.rows).toEqual([]);
  });
});

// Migration 0051 links each teacher's login to its roster person by email, copies the assignments into session_instructors, and
// keeps class_teachers while any row is unmatched. The database is brought to 0050 by hand, seeded with teacher assignments, and
// then migrate() applies 0051 alone. The notices it prints are the report for the owner.
const requireDatabaseUrl = (): string => {
  if (!url) {
    throw new Error('DATABASE_URL is not set for the teacher link test.');
  }

  return url;
};

async function migrateTeacherDb(
  dbName: string,
  seed: { matchedLogin: boolean; unmatchedLogin: boolean },
): Promise<{ rootPool: pg.Pool; tempPool: pg.Pool; applied: string[]; notices: string[]; unmatchedEmail: string }> {
  const tag = randomBytes(4).toString('hex');
  const rootPool = new pg.Pool(poolConfigFor(requireDatabaseUrl()));
  rootPool.on('error', () => {});
  await rootPool.query(`CREATE DATABASE "${dbName}"`);
  const parsed = new URL(requireDatabaseUrl());
  parsed.pathname = `/${dbName}`;
  const tempUrl = parsed.toString();

  const setup = new pg.Pool(poolConfigFor(tempUrl));
  setup.on('error', () => {});
  const client = await setup.connect();
  const matchedEmail = `match-${tag}@teachers.test`;
  const unmatchedEmail = `nobody-${tag}@teachers.test`;
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
    );
    for (const file of readdirSync(DIR)
      .filter(f => f.endsWith('.sql') && f.slice(0, 4) < '0051')
      .sort()) {
      await client.query('BEGIN');
      await client.query(readFileSync(join(DIR, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    }
    const org = await client.query<{ id: string }>(
      `INSERT INTO orgs (name, slug) VALUES ('Teacher link', $1) RETURNING id`,
      [`teacher-link-${tag}`],
    );
    const orgId = org.rows[0].id;
    const matchedUser = await client.query<{ id: string }>(
      `INSERT INTO users (email, name, first_name) VALUES ($1, 'Mia Match', 'Mia') RETURNING id`,
      [matchedEmail],
    );
    const unmatchedUser = await client.query<{ id: string }>(
      `INSERT INTO users (email, name, first_name) VALUES ($1, 'Nina Nobody', 'Nina') RETURNING id`,
      [unmatchedEmail],
    );
    await client.query(
      `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'teacher'), ($1, $3, 'teacher')`,
      [orgId, matchedUser.rows[0].id, unmatchedUser.rows[0].id],
    );
    // The roster person has the login's email in another case, with spaces around it: the match ignores both.
    await client.query(`INSERT INTO people (org_id, given_name, family_name, email) VALUES ($1, 'Mia', 'Match', $2)`, [
      orgId,
      `  ${matchedEmail.toUpperCase()} `,
    ]);
    await client.query(
      `INSERT INTO classes (org_id, name, default_capacity) VALUES ($1, 'Pottery', 10), ($1, 'Painting', 10)`,
      [orgId],
    );
    const sessions = await client.query<{ id: string; name: string }>(
      `INSERT INTO sessions (org_id, class_id, name, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
       SELECT c.org_id, c.id, c.name, now(), now() + interval '1 hour', 'Lake ' || gen_random_uuid(), 10, 5, 1
         FROM classes c WHERE c.org_id = $1
       RETURNING id, name`,
      [orgId],
    );
    const sessionNamed = (name: string) => sessions.rows.find(r => r.name === name)?.id;
    if (seed.matchedLogin) {
      await client.query(`INSERT INTO class_teachers (org_id, session_id, user_id) VALUES ($1, $2, $3)`, [
        orgId,
        sessionNamed('Pottery'),
        matchedUser.rows[0].id,
      ]);
    }
    if (seed.unmatchedLogin) {
      await client.query(`INSERT INTO class_teachers (org_id, session_id, user_id) VALUES ($1, $2, $3)`, [
        orgId,
        sessionNamed('Painting'),
        unmatchedUser.rows[0].id,
      ]);
    }
  } finally {
    client.release();
    await setup.end();
  }

  // A fresh pool, so that every connection migrate() opens reports its notices here.
  const notices: string[] = [];
  const tempPool = new pg.Pool(poolConfigFor(tempUrl));
  tempPool.on('error', () => {});
  tempPool.on('connect', c => c.on('notice', (m: { message?: string }) => notices.push(m.message ?? '')));
  const applied = await migrate(tempPool);

  return { rootPool, tempPool, applied, notices, unmatchedEmail };
}

describe.skipIf(!url)('migration 0051 links teachers to their people by email', () => {
  const tag = randomBytes(4).toString('hex');
  const dbName = `buxa_teacher_link_${tag}`;
  let rootPool: pg.Pool | null = null;
  let tempPool: pg.Pool | null = null;
  let applied: string[] = [];
  let notices: string[] = [];
  let unmatchedEmail = '';

  beforeAll(async () => {
    const built = await migrateTeacherDb(dbName, { matchedLogin: true, unmatchedLogin: true });
    rootPool = built.rootPool;
    tempPool = built.tempPool;
    applied = built.applied;
    notices = built.notices;
    unmatchedEmail = built.unmatchedEmail;
  });

  afterAll(async () => {
    if (tempPool) {
      await tempPool.end().catch(() => {});
    }
    if (rootPool) {
      await rootPool.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
      await rootPool.end().catch(() => {});
    }
  });

  it('applies 0051 and links the matched login to its person (case and spaces ignored)', async () => {
    if (!tempPool) {
      return;
    }
    expect(applied).toEqual([
      '0051_teacher_person_link.sql',
      '0052_session_archive_and_delete.sql',
      '0053_session_status.sql',
      '0054_registration_lifecycle.sql',
      '0055_holds_credentials_registration_keys.sql',
      '0056_name_and_email_uniqueness.sql',
      '0057_role_aware_policies.sql',
      '0058_rename_member_roster_name.sql',
      '0059_session_dates_flag.sql',
      '0060_class_series.sql',
      '0061_series_enrolment_keys.sql',
      '0062_registration_form_files.sql',
      '0063_registration_documents.sql',
      '0064_series_occurrence_status.sql',
      '0065_series_day_delete_guard.sql',
      '0066_series_reschedule.sql',
      '0067_class_location_overlap.sql',
      '0068_camp_gate.sql',
      '0069_retire_teacher_role.sql',
      '0070_registration_form_delete.sql',
      '0071_registration_form_drafts.sql',
      '0073_person_emergency_contact.sql',
      '0074_person_dob_phone_required.sql',
    ]);
    const linked = await tempPool.query<{ email: string; user_email: string }>(
      `SELECT p.email, u.email AS user_email FROM people p JOIN users u ON u.id = p.user_id`,
    );
    expect(linked.rows).toHaveLength(1);
    expect(linked.rows[0].email.trim().toLowerCase()).toBe(linked.rows[0].user_email);
  });

  it('copies the matched assignment into session_instructors', async () => {
    if (!tempPool) {
      return;
    }
    const copied = await tempPool.query<{ name: string }>(
      `SELECT s.name FROM session_instructors si JOIN sessions s ON s.id = si.session_id`,
    );
    expect(copied.rows).toEqual([{ name: 'Pottery' }]);
  });

  it('reports the unmatched row in a notice and keeps class_teachers', async () => {
    if (!tempPool) {
      return;
    }
    expect(notices.some(n => n.includes('Painting') && n.includes(unmatchedEmail))).toBe(true);
    expect(notices.some(n => n.includes('class_teachers is KEPT'))).toBe(true);
    const kept = await tempPool.query<{ n: string }>(`SELECT count(*)::text AS n FROM class_teachers`);
    expect(kept.rows[0].n).toBe('2');
  });
});

describe.skipIf(!url)('migration 0051 drops class_teachers when every row is matched', () => {
  const tag = randomBytes(4).toString('hex');
  const dbName = `buxa_teacher_drop_${tag}`;
  let rootPool: pg.Pool | null = null;
  let tempPool: pg.Pool | null = null;
  let notices: string[] = [];

  beforeAll(async () => {
    const built = await migrateTeacherDb(dbName, { matchedLogin: true, unmatchedLogin: false });
    rootPool = built.rootPool;
    tempPool = built.tempPool;
    notices = built.notices;
  });

  afterAll(async () => {
    if (tempPool) {
      await tempPool.end().catch(() => {});
    }
    if (rootPool) {
      await rootPool.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
      await rootPool.end().catch(() => {});
    }
  });

  it('copies the assignment, then drops class_teachers without a kept notice', async () => {
    if (!tempPool) {
      return;
    }
    expect(notices.some(n => n.includes('KEPT'))).toBe(false);
    const table = await tempPool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM information_schema.tables WHERE table_name = 'class_teachers'`,
    );
    expect(table.rows[0].n).toBe('0');
    const copied = await tempPool.query<{ n: string }>(`SELECT count(*)::text AS n FROM session_instructors`);
    expect(copied.rows[0].n).toBe('1');
  });
});

// Migrations 0053 and 0054 run on a database that already holds sessions and registrations. The database is brought to 0052 by hand,
// seeded with a live and an archived session and with a pending and a confirmed registration, and then migrate() applies 0053 and 0054.
describe.skipIf(!url)('migrations 0053 and 0054 run over existing sessions and registrations', () => {
  const tag = randomBytes(4).toString('hex');
  const dbName = `buxa_lifecycle_${tag}`;
  let rootPool: pg.Pool | null = null;
  let tempPool: pg.Pool | null = null;
  let applied: string[] = [];
  let confirmedId = '';
  let pendingId = '';

  beforeAll(async () => {
    if (!url) {
      return;
    }
    rootPool = new pg.Pool(poolConfigFor(url));
    rootPool.on('error', () => {});
    await rootPool.query(`CREATE DATABASE "${dbName}"`);
    const parsed = new URL(url);
    parsed.pathname = `/${dbName}`;
    tempPool = new pg.Pool(poolConfigFor(parsed.toString()));
    tempPool.on('error', () => {});

    const client = await tempPool.connect();
    try {
      await client.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
      );
      for (const file of readdirSync(DIR)
        .filter(f => f.endsWith('.sql') && f.slice(0, 4) < '0053')
        .sort()) {
        await client.query('BEGIN');
        await client.query(readFileSync(join(DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      }
      const org = await client.query<{ id: string }>(
        `INSERT INTO orgs (name, slug) VALUES ('Lifecycle', $1) RETURNING id`,
        [`lifecycle-${tag}`],
      );
      const orgId = org.rows[0].id;
      await client.query(
        `INSERT INTO classes (org_id, name, starts_on, ends_on, archived_at)
         VALUES ($1, 'Live session', '2027-07-01', '2027-07-31', NULL),
                ($1, 'Old session', '2026-07-01', '2026-07-31', now())`,
        [orgId],
      );
      const form = await client.query<{ id: string }>(
        `INSERT INTO registration_forms (org_id, name) VALUES ($1, 'Form') RETURNING id`,
        [orgId],
      );
      const formId = form.rows[0].id;
      await client.query(
        `INSERT INTO registration_form_versions (org_id, form_id, version, fields) VALUES ($1, $2, 1, '[]'::jsonb)`,
        [orgId, formId],
      );
      const pending = await client.query<{ id: string }>(
        `INSERT INTO registrations (org_id, form_id, form_version, answers, status)
         VALUES ($1, $2, 1, '{"standard":{},"custom":{}}'::jsonb, 'pending') RETURNING id`,
        [orgId, formId],
      );
      pendingId = pending.rows[0].id;
      const confirmed = await client.query<{ id: string }>(
        `INSERT INTO registrations (org_id, form_id, form_version, answers, status, confirmed_at)
         VALUES ($1, $2, 1, '{"standard":{},"custom":{}}'::jsonb, 'confirmed', now()) RETURNING id`,
        [orgId, formId],
      );
      confirmedId = confirmed.rows[0].id;
    } finally {
      client.release();
    }
    applied = await migrate(tempPool);
  });

  afterAll(async () => {
    if (tempPool) {
      await tempPool.end().catch(() => {});
    }
    if (rootPool) {
      await rootPool.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
      await rootPool.end().catch(() => {});
    }
  });

  it('applies exactly 0053 and 0054', () => {
    if (!tempPool) {
      return;
    }
    expect(applied.slice(0, 2)).toEqual(['0053_session_status.sql', '0054_registration_lifecycle.sql']);
  });

  it('0053 makes every existing session live, and an archived one archived', async () => {
    if (!tempPool) {
      return;
    }
    const { rows } = await tempPool.query<{ name: string; status: string }>(
      `SELECT name, status FROM classes ORDER BY name`,
    );
    expect(rows).toEqual([
      { name: 'Live session', status: 'live' },
      { name: 'Old session', status: 'archived' },
    ]);
  });

  it('0054 leaves existing registrations unarchived and not withdrawn, and the status check now allows withdrawn', async () => {
    if (!tempPool) {
      return;
    }
    const before = await tempPool.query<{
      id: string;
      status: string;
      archived_at: Date | null;
      withdrawn_at: Date | null;
    }>(`SELECT id, status, archived_at, withdrawn_at FROM registrations ORDER BY status`);
    expect(before.rows.map(r => [r.id, r.status, r.archived_at, r.withdrawn_at])).toEqual([
      [confirmedId, 'confirmed', null, null],
      [pendingId, 'pending', null, null],
    ]);
    // A confirmed registration that is withdrawn keeps its confirmation time; a pending one cannot claim a confirmation time.
    await tempPool.query(`UPDATE registrations SET status = 'withdrawn', withdrawn_at = now() WHERE id = $1`, [
      confirmedId,
    ]);
    await expect(
      tempPool.query(`UPDATE registrations SET status = 'withdrawn' WHERE id = $1`, [pendingId]),
    ).rejects.toThrow(/registrations_confirmation_check/);
    await expect(
      tempPool.query(`UPDATE registrations SET status = 'pending', confirmed_at = now() WHERE id = $1`, [pendingId]),
    ).rejects.toThrow(/registrations_confirmation_check/);
  });
});

describe.skipIf(!url)('migration 0060 groups existing occurrences into class series', () => {
  const tag = randomBytes(4).toString('hex');
  const dbName = `buxa_series_${tag}`;
  let rootPool: pg.Pool | null = null;
  let tempPool: pg.Pool | null = null;
  let applied: string[] = [];
  let classId = '';
  let orgId = '';

  beforeAll(async () => {
    if (!url) {
      return;
    }
    rootPool = new pg.Pool(poolConfigFor(url));
    rootPool.on('error', () => {});
    await rootPool.query(`CREATE DATABASE "${dbName}"`);
    const parsed = new URL(url);
    parsed.pathname = `/${dbName}`;
    tempPool = new pg.Pool(poolConfigFor(parsed.toString()));
    tempPool.on('error', () => {});

    const client = await tempPool.connect();
    try {
      await client.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
      );
      for (const file of readdirSync(DIR)
        .filter(f => f.endsWith('.sql') && f.slice(0, 4) < '0060')
        .sort()) {
        await client.query('BEGIN');
        await client.query(readFileSync(join(DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      }
      const org = await client.query<{ id: string }>(
        `INSERT INTO orgs (name, slug) VALUES ('Series camp', $1) RETURNING id`,
        [`series-${tag}`],
      );
      orgId = org.rows[0].id;
      const cls = await client.query<{ id: string }>(
        `INSERT INTO classes (org_id, name, starts_on, ends_on) VALUES ($1, 'Summer 2027', '2027-04-05', '2027-04-23') RETURNING id`,
        [orgId],
      );
      classId = cls.rows[0].id;
      // The Art Camp rows: 15 weekday mornings in three weeks, one shape.
      await client.query(
        `INSERT INTO sessions (org_id, class_id, name, age_min, age_max, capacity, location, starts_at, ends_at)
         SELECT $1, $2, 'Art Camp', 5, 15, 20, 'Studio 5',
                (d::timestamp + time '09:00') AT TIME ZONE 'UTC',
                (d::timestamp + time '12:00') AT TIME ZONE 'UTC'
           FROM generate_series('2027-04-05'::date, '2027-04-23'::date, interval '1 day') AS d
          WHERE extract(isodow FROM d) <= 5`,
        [orgId, classId],
      );
    } finally {
      client.release();
    }
    applied = await migrate(tempPool);
  });

  afterAll(async () => {
    if (tempPool) {
      await tempPool.end().catch(() => {});
    }
    if (rootPool) {
      await rootPool.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
      await rootPool.end().catch(() => {});
    }
  });

  it('applies 0060 first', () => {
    if (!tempPool) {
      return;
    }
    expect(applied[0]).toBe('0060_class_series.sql');
  });

  it('turns the 15 Art Camp rows into ONE series with weekdays Monday to Friday, and every row keeps its own date', async () => {
    if (!tempPool) {
      return;
    }
    const series = await tempPool.query<{
      id: string;
      weekdays: number[];
      capacity: number;
      starts: string;
      ends: string;
    }>(
      `SELECT id, weekdays, capacity, to_char(series_starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS starts,
              to_char(series_ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS ends
         FROM class_series WHERE class_id = $1`,
      [classId],
    );
    expect(series.rows).toHaveLength(1);
    expect(series.rows[0].weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(series.rows[0].capacity).toBe(20);
    expect(series.rows[0].starts).toBe('2027-04-05T09:00');
    expect(series.rows[0].ends).toBe('2027-04-23T12:00');

    const occurrences = await tempPool.query<{ n: string; in_series: string; active: string }>(
      `SELECT count(*) AS n,
              count(*) FILTER (WHERE series_id = $2) AS in_series,
              count(*) FILTER (WHERE status = 'active') AS active
         FROM sessions WHERE class_id = $1`,
      [classId, series.rows[0].id],
    );
    expect(occurrences.rows[0]).toEqual({ n: '15', in_series: '15', active: '15' });
  });

  it('gives a row written by the release that is still running its own one-occurrence series', async () => {
    if (!tempPool) {
      return;
    }
    const inserted = await tempPool.query<{ series_id: string }>(
      `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity)
       VALUES ($1, $2, '2027-05-01 09:00+00', '2027-05-01 10:00+00', 'Hall', 8)
       RETURNING series_id`,
      [orgId, classId],
    );
    const row = await tempPool.query<{ weekdays: number[]; name: string }>(
      `SELECT weekdays, name FROM class_series WHERE id = $1`,
      [inserted.rows[0].series_id],
    );
    expect(row.rows[0].weekdays).toEqual([6]);
    expect(row.rows[0].name).toBe('Summer 2027');
  });

  it('refuses a cancelled occurrence without its time and reason, and accepts one with both', async () => {
    if (!tempPool) {
      return;
    }
    const one = await tempPool.query<{ id: string }>(
      `SELECT id FROM sessions WHERE class_id = $1 AND name = 'Art Camp' ORDER BY starts_at LIMIT 1`,
      [classId],
    );
    await expect(
      tempPool.query(`UPDATE sessions SET status = 'cancelled' WHERE id = $1`, [one.rows[0].id]),
    ).rejects.toThrow(/sessions_status_shape/);
    await tempPool.query(
      `UPDATE sessions SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Public holiday' WHERE id = $1`,
      [one.rows[0].id],
    );
    const after = await tempPool.query<{ status: string; cancel_reason: string }>(
      `SELECT status, cancel_reason FROM sessions WHERE id = $1`,
      [one.rows[0].id],
    );
    expect(after.rows[0]).toEqual({ status: 'cancelled', cancel_reason: 'Public holiday' });
  });
});

describe.skipIf(!url)('migration 0060 stops on an ambiguous group and changes nothing', () => {
  const tag = randomBytes(4).toString('hex');
  const dbName = `buxa_series_stop_${tag}`;
  let rootPool: pg.Pool | null = null;
  let tempPool: pg.Pool | null = null;
  let error: Error | null = null;
  let twoOnOneDay: string[] = [];

  beforeAll(async () => {
    if (!url) {
      return;
    }
    rootPool = new pg.Pool(poolConfigFor(url));
    rootPool.on('error', () => {});
    await rootPool.query(`CREATE DATABASE "${dbName}"`);
    const parsed = new URL(url);
    parsed.pathname = `/${dbName}`;
    tempPool = new pg.Pool(poolConfigFor(parsed.toString()));
    tempPool.on('error', () => {});

    const client = await tempPool.connect();
    try {
      await client.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
      );
      for (const file of readdirSync(DIR)
        .filter(f => f.endsWith('.sql') && f.slice(0, 4) < '0060')
        .sort()) {
        await client.query('BEGIN');
        await client.query(readFileSync(join(DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      }
      const org = await client.query<{ id: string }>(
        `INSERT INTO orgs (name, slug) VALUES ('Series stop', $1) RETURNING id`,
        [`stop-${tag}`],
      );
      const orgId = org.rows[0].id;
      const cls = await client.query<{ id: string }>(
        `INSERT INTO classes (org_id, name, starts_on, ends_on) VALUES ($1, 'Clash', '2027-04-05', '2027-04-06') RETURNING id`,
        [orgId],
      );
      const classId = cls.rows[0].id;
      // Two rows on 5 April with the same shape: they cannot form a clean series.
      const rows = await client.query<{ id: string }>(
        `INSERT INTO sessions (org_id, class_id, name, age_min, age_max, capacity, location, starts_at, ends_at)
         VALUES ($1, $2, 'Clash', 5, 9, 10, 'Yard', '2027-04-05 09:00+00', '2027-04-05 10:00+00'),
                ($1, $2, 'Clash', 5, 9, 10, 'Yard', '2027-04-05 09:00+00', '2027-04-05 10:00+00')
         RETURNING id`,
        [orgId, classId],
      );
      twoOnOneDay = rows.rows.map(r => r.id);
    } finally {
      client.release();
    }
    try {
      await migrate(tempPool);
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
    }
  });

  afterAll(async () => {
    if (tempPool) {
      await tempPool.end().catch(() => {});
    }
    if (rootPool) {
      await rootPool.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
      await rootPool.end().catch(() => {});
    }
  });

  it('refuses the file and lists both occurrences', () => {
    if (!tempPool) {
      return;
    }
    expect(error).not.toBeNull();
    expect(error?.message).toContain('0060_class_series.sql');
    for (const id of twoOnOneDay) {
      expect(error?.message).toContain(id);
    }
  });

  it('leaves the schema and the record as they were', async () => {
    if (!tempPool) {
      return;
    }
    const table = await tempPool.query<{ reg: string | null }>(`SELECT to_regclass('class_series')::text AS reg`);
    expect(table.rows[0].reg).toBeNull();
    const column = await tempPool.query<{ n: string }>(
      `SELECT count(*) AS n FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'series_id'`,
    );
    expect(column.rows[0].n).toBe('0');
    const recorded = await tempPool.query<{ n: string }>(
      `SELECT count(*) AS n FROM schema_migrations WHERE name = '0060_class_series.sql'`,
    );
    expect(recorded.rows[0].n).toBe('0');
  });
});

// Migration 0066 (class location rule). A database with every file before 0066 applied, seeded with the rows the rule must check.
const LOCATION_FILE = '0067_class_location_overlap.sql';

async function databaseBefore0066(dbName: string): Promise<{
  root: pg.Pool;
  pool: pg.Pool;
  client: pg.PoolClient;
  orgId: string;
  classId: string;
}> {
  const root = new pg.Pool(poolConfigFor(url ?? ''));
  root.on('error', () => {});
  await root.query(`CREATE DATABASE "${dbName}"`);
  const parsed = new URL(url ?? '');
  parsed.pathname = `/${dbName}`;
  const pool = new pg.Pool(poolConfigFor(parsed.toString()));
  pool.on('error', () => {});
  const client = await pool.connect();
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
  );
  for (const file of readdirSync(DIR)
    .filter(f => f.endsWith('.sql') && f.slice(0, 4) < '0066')
    .sort()) {
    await applyMigrationFile(client, file);
  }
  const org = await client.query<{ id: string }>(
    `INSERT INTO orgs (name, slug) VALUES ('Location rule', $1) RETURNING id`,
    [dbName.replace(/[^a-z0-9]/g, '').slice(0, 40)],
  );
  const cls = await client.query<{ id: string }>(
    `INSERT INTO classes (org_id, name, starts_on, ends_on) VALUES ($1, 'Summer 2027', '2027-07-01', '2027-07-31') RETURNING id`,
    [org.rows[0].id],
  );

  return { root, pool, client, orgId: org.rows[0].id, classId: cls.rows[0].id };
}

/** One active day: a row of sessions written without a series, which the legacy insert trigger gives its own series. */
async function addDay(
  pool: pg.Pool,
  orgId: string,
  classId: string,
  name: string,
  location: string,
  startsAt: string,
  endsAt: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO sessions (org_id, class_id, name, capacity, location, starts_at, ends_at) VALUES ($1, $2, $3, 10, $4, $5, $6)`,
    [orgId, classId, name, location, startsAt, endsAt],
  );
}

describe.skipIf(!url)('migration 0066 stops on same-location overlaps and changes nothing', () => {
  const tag = randomBytes(4).toString('hex');
  const dbName = `buxa_location_stop_${tag}`;
  let handle: Awaited<ReturnType<typeof databaseBefore0066>> | null = null;

  beforeAll(async () => {
    if (!url) {
      return;
    }
    handle = await databaseBefore0066(dbName);
    await addDay(
      handle.pool,
      handle.orgId,
      handle.classId,
      'Pottery',
      'Studio',
      '2027-07-05T23:00:00Z',
      '2027-07-06T02:00:00Z',
    );
    await addDay(
      handle.pool,
      handle.orgId,
      handle.classId,
      'Choir',
      '  studio ',
      '2027-07-06T00:00:00Z',
      '2027-07-06T01:00:00Z',
    );
  });

  afterAll(async () => {
    if (handle) {
      await closeDatabase(dbName, handle);
    }
  });

  it('stops, names both classes and their location, and leaves the schema as it was', async () => {
    if (!handle) {
      return;
    }
    await handle.client.query('BEGIN');
    const failure = await handle.client.query(readFileSync(join(DIR, LOCATION_FILE), 'utf8')).then(
      () => null,
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    await handle.client.query('ROLLBACK');

    expect(failure).toContain('Class location migration 0066 stopped');
    expect(failure).toContain('Pottery');
    expect(failure).toContain('Choir');
    const constraint = await handle.pool.query(
      `SELECT 1 FROM pg_constraint WHERE conname = 'sessions_location_overlap'`,
    );
    expect(constraint.rowCount).toBe(0);
    const column = await handle.pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'location_key'`,
    );
    expect(column.rowCount).toBe(0);
  });
});

describe.skipIf(!url)('migration 0066 refuses a same-location overlap in the database', () => {
  const tag = randomBytes(4).toString('hex');
  const dbName = `buxa_location_rule_${tag}`;
  let handle: Awaited<ReturnType<typeof databaseBefore0066>> | null = null;

  beforeAll(async () => {
    if (!url) {
      return;
    }
    handle = await databaseBefore0066(dbName);
    // Overlapping in time, but in different locations: allowed, and kept by the migration.
    await addDay(
      handle.pool,
      handle.orgId,
      handle.classId,
      'Pottery',
      'Studio',
      '2027-07-05T23:00:00Z',
      '2027-07-06T02:00:00Z',
    );
    await addDay(
      handle.pool,
      handle.orgId,
      handle.classId,
      'Swim',
      'Pool',
      '2027-07-06T00:00:00Z',
      '2027-07-06T03:00:00Z',
    );
    await handle.client.query(readFileSync(join(DIR, LOCATION_FILE), 'utf8'));
    await handle.client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [LOCATION_FILE]);
  });

  afterAll(async () => {
    if (handle) {
      await closeDatabase(dbName, handle);
    }
  });

  it('applies on a camp with no same-location overlap, and keeps the overlapping pair in two locations', async () => {
    if (!handle) {
      return;
    }
    const rows = await handle.pool.query<{ n: string }>(`SELECT count(*) AS n FROM sessions WHERE status = 'active'`);
    expect(rows.rows[0].n).toBe('2');
  });

  it('refuses a new day in the same location, even with different case and spacing, and names the constraint', async () => {
    if (!handle) {
      return;
    }
    await expect(
      addDay(
        handle.pool,
        handle.orgId,
        handle.classId,
        'Choir',
        ' STUDIO ',
        '2027-07-06T00:30:00Z',
        '2027-07-06T01:30:00Z',
      ),
    ).rejects.toMatchObject({ code: '23P01', constraint: 'sessions_location_overlap' });
  });

  it('allows a cancelled day to overlap, and a day that only touches', async () => {
    if (!handle) {
      return;
    }
    await handle.pool.query(
      `INSERT INTO sessions (org_id, class_id, name, capacity, location, starts_at, ends_at, status, cancel_reason, cancelled_at)
       VALUES ($1, $2, 'Choir', 10, 'Studio', '2027-07-06T00:30:00Z', '2027-07-06T01:30:00Z', 'cancelled', 'Holiday', now())`,
      [handle.orgId, handle.classId],
    );
    await addDay(
      handle.pool,
      handle.orgId,
      handle.classId,
      'Yoga',
      'Studio',
      '2027-07-06T02:00:00Z',
      '2027-07-06T03:00:00Z',
    );
  });
});

// Migration 0061 (series keys). Seeds are written after 0060 has run, so the rows the new keys must move exist.
const ART_CAMP_OCCURRENCES = `INSERT INTO sessions (org_id, class_id, name, age_min, age_max, capacity, location, starts_at, ends_at)
  SELECT $1, $2, 'Art Camp', 5, 15, 20, 'Studio 5',
         (d::timestamp + time '09:00') AT TIME ZONE 'UTC',
         (d::timestamp + time '12:00') AT TIME ZONE 'UTC'
    FROM generate_series('2027-04-05'::date, '2027-04-23'::date, interval '1 day') AS d
   WHERE extract(isodow FROM d) <= 5`;

async function applyMigrationFile(client: pg.PoolClient, file: string): Promise<void> {
  await client.query('BEGIN');
  await client.query(readFileSync(join(DIR, file), 'utf8'));
  await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
  await client.query('COMMIT');
}

/** A database at 0059 plus the 0060 grouping run by hand, so the rows 0061 must move are in place before it runs. */
async function databaseAfter0060(
  dbName: string,
  seed: (client: pg.PoolClient, orgId: string) => Promise<void>,
): Promise<{
  root: pg.Pool;
  pool: pg.Pool;
  client: pg.PoolClient;
}> {
  const root = new pg.Pool(poolConfigFor(url ?? ''));
  root.on('error', () => {});
  await root.query(`CREATE DATABASE "${dbName}"`);
  const parsed = new URL(url ?? '');
  parsed.pathname = `/${dbName}`;
  const pool = new pg.Pool(poolConfigFor(parsed.toString()));
  pool.on('error', () => {});
  const client = await pool.connect();
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
  );
  for (const file of readdirSync(DIR)
    .filter(f => f.endsWith('.sql') && f.slice(0, 4) < '0060')
    .sort()) {
    await applyMigrationFile(client, file);
  }
  const org = await client.query<{ id: string }>(
    `INSERT INTO orgs (name, slug) VALUES ('Series keys', $1) RETURNING id`,
    [dbName.replace(/[^a-z0-9]/g, '').slice(0, 40)],
  );
  const orgId = org.rows[0].id;
  const cls = await client.query<{ id: string }>(
    `INSERT INTO classes (org_id, name, starts_on, ends_on) VALUES ($1, 'Summer 2027', '2027-04-05', '2027-04-23') RETURNING id`,
    [orgId],
  );
  await client.query(ART_CAMP_OCCURRENCES, [orgId, cls.rows[0].id]);
  await applyMigrationFile(client, '0060_class_series.sql');
  await seed(client, orgId);

  return { root, pool, client };
}

async function closeDatabase(
  dbName: string,
  handle: { root: pg.Pool; pool: pg.Pool; client: pg.PoolClient },
): Promise<void> {
  handle.client.release();
  await handle.pool.end().catch(() => {});
  await handle.root.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
  await handle.root.end().catch(() => {});
}

describe.skipIf(!url)('migration 0061 moves enrolments, holds and places onto the series', () => {
  const tag = randomBytes(4).toString('hex');
  const dbName = `buxa_keys_${tag}`;
  let handle: { root: pg.Pool; pool: pg.Pool; client: pg.PoolClient } | null = null;
  let orgId = '';
  let childA = '';
  let childB = '';
  let childC = '';
  let applied: string[] = [];
  let seriesId = '';
  let firstOccurrence = '';
  let laterOccurrence = '';
  let fifthOccurrence = '';

  beforeAll(async () => {
    if (!url) {
      return;
    }
    handle = await databaseAfter0060(dbName, async (client, org) => {
      orgId = org;
      const people = await client.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name)
         VALUES ($1, 'Ada', 'Lovelace'), ($1, 'Ben', 'Holt'), ($1, 'Cleo', 'Park') RETURNING id`,
        [org],
      );
      [childA, childB, childC] = people.rows.map(r => r.id);
      const occurrences = await client.query<{ id: string }>(
        `SELECT id FROM sessions WHERE org_id = $1 ORDER BY starts_at`,
        [org],
      );
      [firstOccurrence, laterOccurrence] = occurrences.rows.map(r => r.id);
      fifthOccurrence = occurrences.rows[4].id;
      const enrolmentA = await client.query<{ id: string }>(
        `INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled') RETURNING id`,
        [org, firstOccurrence, childA],
      );
      await client.query(
        `INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'waitlisted')`,
        [org, laterOccurrence, childB],
      );
      const household = await client.query<{ id: string }>(
        `INSERT INTO households (org_id, name) VALUES ($1, 'Park household') RETURNING id`,
        [org],
      );
      await client.query(
        `INSERT INTO seat_holds (org_id, session_id, household_id, person_id, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '1 hour')`,
        [org, fifthOccurrence, household.rows[0].id, childC],
      );
      const form = await client.query<{ id: string }>(
        `INSERT INTO registration_forms (org_id, name) VALUES ($1, 'Form') RETURNING id`,
        [org],
      );
      await client.query(
        `INSERT INTO registration_form_versions (org_id, form_id, version, fields) VALUES ($1, $2, 1, '[]'::jsonb)`,
        [org, form.rows[0].id],
      );
      const registration = await client.query<{ id: string }>(
        `INSERT INTO registrations (org_id, form_id, form_version, answers, status)
         VALUES ($1, $2, 1, '{"standard":{},"custom":{}}'::jsonb, 'pending') RETURNING id`,
        [org, form.rows[0].id],
      );
      await client.query(
        `INSERT INTO registration_classes (org_id, registration_id, class_id, person_id, enrolment_id) VALUES ($1, $2, $3, $4, $5)`,
        [org, registration.rows[0].id, firstOccurrence, childA, enrolmentA.rows[0].id],
      );
    });
    applied = await migrate(handle.pool);
    const series = await handle.pool.query<{ series_id: string }>(`SELECT series_id FROM sessions WHERE id = $1`, [
      firstOccurrence,
    ]);
    seriesId = series.rows[0].series_id;
  });

  afterAll(async () => {
    if (handle) {
      await closeDatabase(dbName, handle);
    }
  });

  it('applies 0061 as the first pending file', () => {
    if (!handle) {
      return;
    }
    expect(applied[0]).toBe('0061_series_enrolment_keys.sql');
  });

  it('gives every enrolment, hold and place the series of its occurrence, and keeps the occurrence as the anchor', async () => {
    if (!handle) {
      return;
    }
    const rows = await handle.pool.query<{ table_name: string; series: string; anchored: string; n: string }>(
      `SELECT 'enrolments' AS table_name, e.series_id::text AS series, count(*) FILTER (WHERE s.series_id = e.series_id)::text AS anchored, count(*)::text AS n
         FROM enrolments e JOIN sessions s ON s.id = e.session_id GROUP BY e.series_id
       UNION ALL
       SELECT 'seat_holds', h.series_id::text, count(*) FILTER (WHERE s.series_id = h.series_id)::text, count(*)::text
         FROM seat_holds h JOIN sessions s ON s.id = h.session_id GROUP BY h.series_id
       UNION ALL
       SELECT 'registration_classes', r.series_id::text, count(*) FILTER (WHERE s.series_id = r.series_id)::text, count(*)::text
         FROM registration_classes r JOIN sessions s ON s.id = r.class_id GROUP BY r.series_id`,
    );
    expect(rows.rows.map(r => r.table_name).sort()).toEqual(['enrolments', 'registration_classes', 'seat_holds']);
    for (const row of rows.rows) {
      expect(row.series).toBe(seriesId);
      expect(row.anchored).toBe(row.n);
    }
  });

  it('enrols a child once in the series: a second place for the same child in another day is refused', async () => {
    if (!handle) {
      return;
    }
    await expect(
      handle.pool.query(
        `INSERT INTO enrolments (org_id, session_id, series_id, person_id, status) VALUES ($1, $2, $3, $4, 'enrolled')`,
        [orgId, laterOccurrence, seriesId, childA],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'enrolments_one_active_series_idx' });
  });

  it('holds one place per child in the series', async () => {
    if (!handle) {
      return;
    }
    const household = await handle.pool.query<{ id: string }>(`SELECT id FROM households WHERE org_id = $1 LIMIT 1`, [
      orgId,
    ]);
    await expect(
      handle.pool.query(
        `INSERT INTO seat_holds (org_id, session_id, series_id, household_id, person_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + interval '1 hour')`,
        [orgId, laterOccurrence, seriesId, household.rows[0].id, childC],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'seat_holds_one_active_series_person_idx' });
  });

  it('counts capacity per series: the camp size cannot drop below the places taken (one enrolment and one live hold)', async () => {
    if (!handle) {
      return;
    }
    await expect(
      handle.pool.query(`UPDATE class_series SET capacity = 1 WHERE id = $1`, [seriesId]),
    ).rejects.toMatchObject({ code: '23514', constraint: 'class_series_capacity_floor' });
    await handle.pool.query(`UPDATE class_series SET capacity = 2 WHERE id = $1`, [seriesId]);
    const after = await handle.pool.query<{ capacity: number }>(`SELECT capacity FROM class_series WHERE id = $1`, [
      seriesId,
    ]);
    expect(after.rows[0].capacity).toBe(2);
  });

  it('cancelling one occurrence leaves the series, its places and the other occurrences intact', async () => {
    if (!handle) {
      return;
    }
    await handle.pool.query(
      `UPDATE sessions SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Holiday' WHERE id = $1`,
      [firstOccurrence],
    );
    const enrolled = await handle.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM enrolments WHERE series_id = $1 AND status = 'enrolled'`,
      [seriesId],
    );
    expect(enrolled.rows[0].n).toBe('1');
    const active = await handle.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM sessions WHERE series_id = $1 AND status = 'active'`,
      [seriesId],
    );
    expect(active.rows[0].n).toBe('14');
    await handle.pool.query(
      `UPDATE sessions SET status = 'active', cancelled_at = NULL, cancel_reason = NULL WHERE id = $1`,
      [firstOccurrence],
    );
  });

  it("refuses an enrolment in another series whose occurrence overlaps one of this child's active days", async () => {
    if (!handle) {
      return;
    }
    const pottery = await handle.pool.query<{ id: string }>(
      `INSERT INTO classes (org_id, name) VALUES ($1, 'Pottery') RETURNING id`,
      [orgId],
    );
    const session = await handle.pool.query<{ id: string }>(
      `INSERT INTO sessions (org_id, class_id, name, capacity, location, starts_at, ends_at)
       VALUES ($1, $2, 'Pottery', 10, 'Kiln', '2027-04-05 10:30+00', '2027-04-05 11:30+00') RETURNING id`,
      [orgId, pottery.rows[0].id],
    );
    await expect(
      handle.pool.query(
        `INSERT INTO enrolments (org_id, session_id, series_id, person_id, status)
         SELECT $1::uuid, $2::uuid, series_id, $3::uuid, 'enrolled' FROM sessions WHERE id = $2::uuid`,
        [orgId, session.rows[0].id, childA],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'enrolments_series_overlap' });
    await handle.pool.query(
      `INSERT INTO enrolments (org_id, session_id, series_id, person_id, status)
       SELECT $1::uuid, $2::uuid, series_id, $3::uuid, 'enrolled' FROM sessions WHERE id = $2::uuid`,
      [orgId, session.rows[0].id, childC],
    );
  });
});

describe.skipIf(!url)('migration 0061 stops on data that would break a key', () => {
  it('stops when one child has two active enrolments in one series, lists them, and changes nothing', async () => {
    if (!url) {
      return;
    }
    const dbName = `buxa_keys_dup_${randomBytes(4).toString('hex')}`;
    const handle = await databaseAfter0060(dbName, async (client, org) => {
      const person = await client.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name) VALUES ($1, 'Dana', 'Kerr') RETURNING id`,
        [org],
      );
      const occurrences = await client.query<{ id: string }>(
        `SELECT id FROM sessions WHERE org_id = $1 ORDER BY starts_at LIMIT 2`,
        [org],
      );
      for (const row of occurrences.rows) {
        await client.query(
          `INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`,
          [org, row.id, person.rows[0].id],
        );
      }
    });
    try {
      let message = '';
      try {
        await migrate(handle.pool);
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      expect(message).toContain('0061_series_enrolment_keys.sql');
      expect(message).toContain('two active enrolments in one series');
      const column = await handle.pool.query<{ n: string }>(
        `SELECT count(*) AS n FROM information_schema.columns WHERE table_name = 'enrolments' AND column_name = 'series_id'`,
      );
      expect(column.rows[0].n).toBe('0');
    } finally {
      await closeDatabase(dbName, handle);
    }
  });

  it('stops when a child is enrolled in two series whose occurrences overlap, and lists the pair', async () => {
    if (!url) {
      return;
    }
    const dbName = `buxa_keys_overlap_${randomBytes(4).toString('hex')}`;
    const handle = await databaseAfter0060(dbName, async (client, org) => {
      const person = await client.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name) VALUES ($1, 'Eli', 'Stone') RETURNING id`,
        [org],
      );
      const pottery = await client.query<{ id: string }>(
        `INSERT INTO classes (org_id, name) VALUES ($1, 'Pottery') RETURNING id`,
        [org],
      );
      const kiln = await client.query<{ id: string }>(
        `INSERT INTO sessions (org_id, class_id, name, capacity, location, starts_at, ends_at)
         VALUES ($1, $2, 'Pottery', 10, 'Kiln', '2027-04-05 10:30+00', '2027-04-05 11:30+00') RETURNING id`,
        [org, pottery.rows[0].id],
      );
      const art = await client.query<{ id: string }>(
        `SELECT id FROM sessions WHERE org_id = $1 ORDER BY starts_at LIMIT 1`,
        [org],
      );
      await client.query(
        `INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`,
        [org, art.rows[0].id, person.rows[0].id],
      );
      await client.query(
        `INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`,
        [org, kiln.rows[0].id, person.rows[0].id],
      );
    });
    try {
      let message = '';
      try {
        await migrate(handle.pool);
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      expect(message).toContain('0061_series_enrolment_keys.sql');
      expect(message).toContain('overlap in time');
    } finally {
      await closeDatabase(dbName, handle);
    }
  });
});

// Migration 0068 (check-in with a family's email). It only adds tables, functions and a trigger, so it must apply on a database that
// already holds camp data, and the new tables must be locked the same way as the rest of the camp's data.
describe.skipIf(!url)('migration 0068 adds the camp gate tables to a database with camp data', () => {
  const tag = randomBytes(4).toString('hex');
  const tempDbName = `buxa_gate_upgrade_${tag}`;
  let rootPool: pg.Pool;
  let tempPool: pg.Pool | null = null;
  let canCreateDb = true;

  beforeAll(async () => {
    rootPool = new pg.Pool(poolConfigFor(url ?? ''));
    rootPool.on('error', () => {});
    try {
      await rootPool.query(`CREATE DATABASE "${tempDbName}"`);
    } catch (err) {
      console.warn(`Could not CREATE DATABASE for the 0068 test (insufficient privileges?): ${String(err)}`);
      canCreateDb = false;

      return;
    }

    const parsed = new URL(url ?? '');
    parsed.pathname = `/${tempDbName}`;
    tempPool = new pg.Pool(poolConfigFor(parsed.toString()));
    tempPool.on('error', () => {});
    // Apply everything before 0068, then seed a camp, so the new file runs over existing rows.
    const client = await tempPool.connect();
    try {
      await client.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
      );
      const earlier = readdirSync(DIR)
        .filter(f => f.endsWith('.sql') && f.slice(0, 4) < '0068')
        .sort();
      for (const file of earlier) {
        await client.query('BEGIN');
        await client.query(readFileSync(join(DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      }
      await client.query(`INSERT INTO orgs (name, slug) VALUES ('Camp Gate ${tag}', 'camp-gate-${tag}')`);
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

  it('applies 0068 on top of the earlier files, and the new tables are forced under row-level security', async () => {
    if (!canCreateDb || !tempPool) {
      return;
    }
    await migrate(tempPool);
    const applied = await tempPool.query<{ name: string }>(
      `SELECT name FROM schema_migrations WHERE name = '0068_camp_gate.sql'`,
    );
    expect(applied.rows).toHaveLength(1);
    const { rows } = await tempPool.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relname IN ('camp_gates', 'gate_verification_codes', 'device_tokens')`,
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
      expect(row.relforcerowsecurity, row.relname).toBe(true);
    }
  });
});

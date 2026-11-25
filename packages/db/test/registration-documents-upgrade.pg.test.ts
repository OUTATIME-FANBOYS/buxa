import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate, poolConfigFor } from '../src';

const url = process.env.DATABASE_URL;
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

// Migrations 0060 (form attachments) and 0061 (document questions) are additive: new tables and a new function. This test builds
// a database at 0059, stores a registration with its answers and a form with its published version, then applies 0060 and 0061 to
// it. The existing rows must survive unchanged, and the new tables must be empty and in place.
describe.skipIf(!url)('migrations 0060 and 0061 on a database that already has registrations', () => {
  const tag = randomBytes(4).toString('hex');
  const tempDbName = `buxa_docs_upgrade_${tag}`;
  let rootPool: pg.Pool;
  let tempPool: pg.Pool | null = null;
  let registrationId = '';
  const answers = {
    standard: { camperFirstName: 'Ada', camperLastName: 'Lovelace', camperBirthDate: '2014-03-09' },
    custom: { photos: true },
  };

  const replaceDatabaseName = (connUrl: string, newDb: string): string => {
    const parsed = new URL(connUrl);
    parsed.pathname = `/${newDb}`;

    return parsed.toString();
  };

  beforeAll(async () => {
    if (!url) {
      return;
    }
    rootPool = new pg.Pool(poolConfigFor(url));
    rootPool.on('error', () => {});
    await rootPool.query(`CREATE DATABASE "${tempDbName}"`);
    tempPool = new pg.Pool(poolConfigFor(replaceDatabaseName(url, tempDbName)));
    tempPool.on('error', () => {});

    const client = await tempPool.connect();
    try {
      await client.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
      );
      const before = readdirSync(DIR)
        .filter(f => f.endsWith('.sql') && f.slice(0, 4) <= '0059')
        .sort();
      for (const file of before) {
        await client.query('BEGIN');
        await client.query(readFileSync(join(DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      }

      const org = await client.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING id`, [
        `Docs upgrade ${tag}`,
        `docs-upgrade-${tag}`,
      ]);
      const orgId = org.rows[0]?.id ?? '';
      const user = await client.query<{ id: string }>(
        `INSERT INTO users (email, name) VALUES ($1, 'Upgrade') RETURNING id`,
        [`docs-upgrade-${tag}@upgrade.test`],
      );
      const userId = user.rows[0]?.id ?? '';
      await client.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'admin')`, [orgId, userId]);
      const form = await client.query<{ id: string }>(
        `INSERT INTO registration_forms (org_id, name) VALUES ($1, 'Summer') RETURNING id`,
        [orgId],
      );
      const formId = form.rows[0]?.id ?? '';
      await client.query(
        `INSERT INTO registration_form_versions (org_id, form_id, version, fields) VALUES ($1, $2, 1, '[]'::jsonb)`,
        [orgId, formId],
      );
      await client.query('UPDATE registration_forms SET published_version = 1 WHERE id = $1', [formId]);
      const registration = await client.query<{ id: string }>(
        `INSERT INTO registrations (org_id, form_id, form_version, answers) VALUES ($1, $2, 1, $3::jsonb) RETURNING id`,
        [orgId, formId, JSON.stringify(answers)],
      );
      registrationId = registration.rows[0]?.id ?? '';
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    if (tempPool) {
      await tempPool.end().catch(() => {});
    }
    if (rootPool) {
      await rootPool.query(`DROP DATABASE IF EXISTS "${tempDbName}" WITH (FORCE)`).catch(() => {});
      await rootPool.end().catch(() => {});
    }
  });

  it('applies 0060 and 0061 and leaves the stored registration exactly as it was', async () => {
    if (!tempPool) {
      return;
    }
    const applied = await migrate(tempPool);
    expect(applied).toEqual(
      expect.arrayContaining(['0062_registration_form_files.sql', '0063_registration_documents.sql']),
    );

    const row = await tempPool.query<{ answers: unknown }>('SELECT answers FROM registrations WHERE id = $1', [
      registrationId,
    ]);
    expect(row.rows[0]?.answers).toEqual(answers);

    const files = await tempPool.query<{ forms: string; registrations: string }>(
      `SELECT (SELECT count(*) FROM registration_form_files)::text AS forms,
              (SELECT count(*) FROM registration_files)::text AS registrations`,
    );
    expect(files.rows[0]).toEqual({ forms: '0', registrations: '0' });
  });
});

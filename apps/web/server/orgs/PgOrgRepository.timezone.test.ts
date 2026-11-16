import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { PgOrgRepository } from './PgOrgRepository';

const url = process.env.DATABASE_URL;

// The camp's time zone decides what "today" and "valid" mean, so it must survive creation, read-back and rename.
describe.skipIf(!url)('PgOrgRepository timezone', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgOrgRepository(pool);
  const tag = randomBytes(6).toString('hex');
  let ownerId = '';

  beforeAll(async () => {
    await migrate(pool);
    const { rows } = await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'Owner') RETURNING id`, [`owner-${tag}@example.test`]);
    ownerId = rows[0].id;
  });
  afterAll(async () => { await pool.end(); });

  it('stores the timezone given at creation and returns it from get', async () => {
    const created = await repo.createWithOwner({ name: 'Tz camp', slug: `tz-${tag}`, timezone: 'Europe/London' }, ownerId);
    const org = await repo.get(created.id);
    expect(org.timezone).toBe('Europe/London');
  });

  it('defaults to UTC when the column is not given', async () => {
    const { rows } = await pool.query<{ timezone: string }>(`INSERT INTO orgs (name, slug) VALUES ('Default', $1) RETURNING timezone`, [`tz-default-${tag}`]);
    expect(rows[0].timezone).toBe('UTC');
  });

  it('rename changes the timezone when given, and keeps it when not', async () => {
    const created = await repo.createWithOwner({ name: 'Rename camp', slug: `tz-rename-${tag}`, timezone: 'Europe/London' }, ownerId);
    const actor = { userId: ownerId, orgId: created.id, role: 'owner' as const };
    await repo.rename(actor, { timezone: 'America/New_York' });
    expect((await repo.get(created.id)).timezone).toBe('America/New_York');
    await repo.rename(actor, { name: 'Renamed' });
    const after = await repo.get(created.id);
    expect(after).toMatchObject({ name: 'Renamed', timezone: 'America/New_York' });
  });
});

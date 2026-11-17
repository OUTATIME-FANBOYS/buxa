import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { PgOrgRepository } from './PgOrgRepository';

const url = process.env.DATABASE_URL;

// The camp's clock (12 or 24 hour) is stored on the camp's row, so it must default to 24 hour, survive a save and read back.
describe.skipIf(!url)('PgOrgRepository clock format', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgOrgRepository(pool);
  const tag = randomBytes(6).toString('hex');
  let ownerId = '';

  beforeAll(async () => {
    await migrate(pool);
    const { rows } = await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'Clock owner') RETURNING id`, [`clock-${tag}@example.test`]);
    ownerId = rows[0].id;
  });
  afterAll(async () => {
    await pool.end();
  });

  it('defaults to 24-hour for a new camp', async () => {
    const created = await repo.createWithOwner({ name: 'Clock default', slug: `clock-default-${tag}`, timezone: 'Europe/London' }, ownerId);
    expect((await repo.get(created.id)).clockFormat).toBe('24h');
  });

  it('saves the camp clock and reads it back for that camp only', async () => {
    const camp = await repo.createWithOwner({ name: 'Clock saved', slug: `clock-saved-${tag}`, timezone: 'Europe/London' }, ownerId);
    const other = await repo.createWithOwner({ name: 'Clock other', slug: `clock-other-${tag}`, timezone: 'Europe/London' }, ownerId);
    const actor = { userId: ownerId, orgId: camp.id, role: 'owner' as const };

    await repo.rename(actor, { clockFormat: '12h' });
    expect((await repo.get(camp.id)).clockFormat).toBe('12h');
    expect((await repo.get(other.id)).clockFormat).toBe('24h');

    await repo.rename(actor, { name: 'Clock saved again' });
    expect(await repo.get(camp.id)).toMatchObject({ name: 'Clock saved again', clockFormat: '12h' });
  });

  it('refuses a value other than 12h or 24h', async () => {
    await expect(pool.query(`INSERT INTO orgs (name, slug, clock_format) VALUES ('Bad clock', $1, '13h')`, [`clock-bad-${tag}`]))
      .rejects.toThrow(/clock_format/);
  });
});

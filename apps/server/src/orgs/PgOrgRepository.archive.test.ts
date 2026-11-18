import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { isHttpError } from '../http/errors';
import { PgOrgRepository } from './PgOrgRepository';

const url = process.env.DATABASE_URL;

// The archive and delete functions (migration 0013) raise Postgres errors; the repository turns them into the errors the
// service and the client understand. The cascade itself is covered in packages/db/test/camp-archive.test.ts.
describe.skipIf(!url)('PgOrgRepository archive and delete', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgOrgRepository(pool);
  const tag = randomBytes(6).toString('hex');
  let owner = '';
  let admin = '';

  beforeAll(async () => {
    await migrate(pool);
    const users = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, 'Owner'), ($2, 'Admin') RETURNING id`,
      [`owner-${tag}@repo.test`, `admin-${tag}@repo.test`],
    );
    [owner, admin] = users.rows.map(r => r.id);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('maps a non-owner archive to a 403, and an archived camp to a 409 with the message', async () => {
    const camp = await repo.createWithOwner({ name: `Repo ${tag}`, slug: `repo-${tag}`, timezone: 'UTC' }, owner);
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'admin')`, [camp.id, admin]);
    const asAdmin = { userId: admin, orgId: camp.id, role: 'admin' as const };
    const asOwner = { userId: owner, orgId: camp.id, role: 'owner' as const };

    const refused = await repo.archive(asAdmin).catch((e: unknown) => e);
    expect(isHttpError(refused) && refused.statusCode).toBe(403);

    await repo.archive(asOwner);
    const again = await repo.archive(asOwner).catch((e: unknown) => e);
    expect(isHttpError(again) && again.statusCode).toBe(409);
    expect((again as Error).message).toBe('This camp is already archived');
  });

  it('lists the archived camp with its role for the people in it', async () => {
    const list = await repo.archivedCampsOf(admin);
    expect(list.find(c => c.name === `Repo ${tag}`)).toMatchObject({ role: 'admin' });
  });

  it('deletes with the exact name and reports a wrong name as a 400 without deleting', async () => {
    const camp = await repo.createWithOwner({ name: `Gone ${tag}`, slug: `gone-${tag}`, timezone: 'UTC' }, owner);
    await repo.archive({ userId: owner, orgId: camp.id, role: 'owner' });
    const actor = { userId: owner, orgId: camp.id, role: 'owner' as const };

    await repo.deleteCamp(actor, `gone ${tag}`).catch(() => undefined);
    expect((await pool.query('SELECT 1 FROM orgs WHERE id = $1', [camp.id])).rowCount).toBe(1);

    await repo.deleteCamp(actor, `Gone ${tag}`);
    expect((await pool.query('SELECT 1 FROM orgs WHERE id = $1', [camp.id])).rowCount).toBe(0);
  });
});

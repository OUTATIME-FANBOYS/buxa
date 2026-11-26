import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { PgOrgRepository } from '../../orgs/PgOrgRepository';
import { PgUserRepository } from '../PgUserRepository';

const url = process.env.DATABASE_URL;

// A member rename changes the camp's roster name (people), never the login's name (users), so it must leave exactly one member.rename audit row, in the camp the
// actor acted in, written in the same transaction as the rename. A refused rename (the person is not in that camp) must
// leave none. Creating a camp writes its own org.create row, so the assertions look only at member.rename rows.
describe.skipIf(!url)('PgUserRepository.renameMember audit', () => {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const users = new PgUserRepository(pool);
  const orgs = new PgOrgRepository(pool);
  const tag = randomBytes(4).toString('hex');
  let ownerId = '';
  let targetId = '';
  let campId = '';
  let otherCampId = '';

  const renameRows = (orgId: string) =>
    withOrg(pool, ownerId, orgId, async db => {
      const { rows } = await db.query<{
        actor_id: string;
        action: string;
        entity: string;
        entity_id: string;
        data: unknown;
      }>('SELECT actor_id, action, entity, entity_id, data FROM audit_log WHERE action = $1 ORDER BY id', [
        'member.rename',
      ]);

      return rows;
    });

  beforeAll(async () => {
    await migrate(pool);
    ownerId = (
      await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'Owner') RETURNING id`, [
        `rename-owner-${tag}@example.test`,
      ])
    ).rows[0].id;
    targetId = (
      await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'Target') RETURNING id`, [
        `rename-target-${tag}@example.test`,
      ])
    ).rows[0].id;
    campId = (await orgs.createWithOwner({ name: 'Rename camp', slug: `rename-${tag}`, timezone: 'UTC' }, ownerId)).id;
    otherCampId = (
      await orgs.createWithOwner({ name: 'Other camp', slug: `rename-other-${tag}`, timezone: 'UTC' }, ownerId)
    ).id;
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'viewer')`, [campId, targetId]);
    await pool.query(
      `INSERT INTO people (org_id, given_name, family_name, user_id, date_of_birth, phone) VALUES ($1, 'Old', 'Name', $2, '1985-06-15', '+1 555 0100')`,
      [campId, targetId],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('a successful rename writes one audit row with the actor, the camp and the person renamed', async () => {
    const actor = { userId: ownerId, orgId: campId, role: 'owner' as const };
    const renamed = await users.renameMember(actor, targetId, 'Rosa Delgado');
    expect(renamed).toMatchObject({ id: targetId, name: 'Rosa Delgado' });
    const roster = await pool.query<{ n: string }>(
      `SELECT given_name || ' ' || family_name AS n FROM people WHERE user_id = $1`,
      [targetId],
    );
    expect(roster.rows[0].n).toBe('Rosa Delgado');
    const login = await pool.query<{ name: string }>('SELECT name FROM users WHERE id = $1', [targetId]);
    expect(login.rows[0].name).toBe('Target');

    expect(await renameRows(campId)).toEqual([
      {
        actor_id: ownerId,
        action: 'member.rename',
        entity: 'user',
        entity_id: targetId,
        data: { name: 'Rosa Delgado' },
      },
    ]);
  });

  it('a refused rename (the person is not in this camp) writes no audit row', async () => {
    const actor = { userId: ownerId, orgId: otherCampId, role: 'owner' as const };
    expect(await users.renameMember(actor, targetId, 'Nobody Here')).toBeNull();

    expect(await renameRows(otherCampId)).toEqual([]);
    expect(await renameRows(campId)).toHaveLength(1);
  });
});

import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { PgOrgRepository } from '../../orgs/PgOrgRepository';
import { PgUserRepository } from '../PgUserRepository';

const url = process.env.DATABASE_URL;

// Turning an option on writes exactly one member.option_set audit row, in the camp the admin acted in, in the same transaction. A
// refused write (the person is not a teacher) writes no row and leaves the option off.
describe.skipIf(!url)('PgUserRepository.setMemberOption audit', () => {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const users = new PgUserRepository(pool);
  const orgs = new PgOrgRepository(pool);
  const tag = randomBytes(4).toString('hex');
  let adminId = '';
  let teacherId = '';
  let staffId = '';
  let campId = '';

  const rows = (orgId: string) =>
    withOrg(pool, adminId, orgId, async db => {
      const { rows: r } = await db.query<{ actor_id: string; entity_id: string; data: unknown }>(
        'SELECT actor_id, entity_id, data FROM audit_log WHERE action = $1 ORDER BY id',
        ['member.option_set'],
      );

      return r;
    });

  beforeAll(async () => {
    await migrate(pool);
    const user = async (label: string) =>
      (
        await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'Test') RETURNING id`, [
          `option-${label}-${tag}@example.test`,
        ])
      ).rows[0].id;
    adminId = await user('admin');
    teacherId = await user('teacher');
    staffId = await user('staff');
    campId = (await orgs.createWithOwner({ name: 'Option camp', slug: `option-${tag}`, timezone: 'UTC' }, adminId)).id;
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'viewer'), ($1, $3, 'staff')`, [
      campId,
      teacherId,
      staffId,
    ]);
    // The instructor: a person linked to the login, holding the instructor role (migration 0069).
    const person = await pool.query<{ id: string }>(
      `INSERT INTO people (org_id, given_name, family_name, user_id, date_of_birth, phone) VALUES ($1, 'Tess', 'Teacher', $2, '1985-06-15', '+1 555 0100') RETURNING id`,
      [campId, teacherId],
    );
    await pool.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'instructor')`, [
      campId,
      person.rows[0].id,
    ]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('turning check-in on for a teacher writes one audit row against the admin, in this camp', async () => {
    const actor = { userId: adminId, orgId: campId, role: 'admin' as const };
    await users.setMemberOption(actor, teacherId, 'teacher.check_in_out', true);
    const audit = (await rows(campId)).filter(r => r.entity_id === teacherId);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor_id: adminId, data: { option: 'teacher.check_in_out', enabled: true } });
    expect(await users.memberOptionsOf(adminId, campId, teacherId)).toEqual(['teacher.check_in_out']);
  });

  it('a refused write (not a teacher) writes no audit row and leaves the option off', async () => {
    const actor = { userId: adminId, orgId: campId, role: 'admin' as const };
    await expect(users.setMemberOption(actor, staffId, 'teacher.check_in_out', true)).rejects.toThrow(
      /Instructor not found/,
    );
    expect((await rows(campId)).filter(r => r.entity_id === staffId)).toHaveLength(0);
    expect(await users.memberOptionsOf(adminId, campId, staffId)).toEqual([]);
  });
});

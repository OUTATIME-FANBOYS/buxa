import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '../src';
import { memberOf } from './support';

// Migrations 0057 and 0058: the database now enforces the role for audit_log reads, credentials writes, the camp calendar token and
// member_options, refuses a non-member on notifications and member_options, keeps the badge ciphertext away from the request role,
// and renames a member on the camp's roster only. Everything runs as the restricted request role (withOrg). Needs DATABASE_URL.
const url = process.env.DATABASE_URL;

type Role = 'viewer' | 'staff' | 'teacher' | 'admin' | 'owner';
const ROLES: Role[] = ['viewer', 'staff', 'teacher', 'admin', 'owner'];
const DENIED = /permission denied|row-level security|Not allowed/;

describe.skipIf(!url)('role-aware policies (migrations 0057 and 0058)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(5).toString('hex');
  let camp = '';
  let otherCamp = '';
  const users = new Map<Role, string>();
  let outsider = '';
  let expired = '';
  let personId = '';
  const personEmail = `self-${tag}@roster.test`;

  const as = <T>(userId: string, work: (db: pg.PoolClient) => Promise<T>, org = camp): Promise<T> =>
    withOrg(pool, userId, org, work);
  /** Row count, or 'denied' when the database refuses the statement. */
  const attempt = async (userId: string, sql: string, params: unknown[] = []): Promise<number | 'denied'> => {
    try {
      return (await as(userId, db => db.query(sql, params))).rowCount ?? 0;
    } catch (error) {
      if (error instanceof Error && DENIED.test(error.message)) {
        return 'denied';
      }
      throw error;
    }
  };
  const newOrg = async (name: string): Promise<string> =>
    (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug, timezone) VALUES ($1, $2, 'UTC') RETURNING id`, [
        name,
        `${name.toLowerCase().replace(/\s/g, '-')}-${tag}`,
      ])
    ).rows[0].id;
  const userOf = (role: Role): string => {
    const id = users.get(role);
    if (!id) {
      throw new Error(`no ${role}`);
    }

    return id;
  };

  beforeAll(async () => {
    await migrate(pool);
    camp = await newOrg('Role Camp');
    otherCamp = await newOrg('Role Other');
    for (const role of ROLES) {
      users.set(role, await memberOf(pool, camp, role));
    }
    outsider = await memberOf(pool, otherCamp, 'owner');
    expired = await memberOf(pool, camp, 'admin');
    await pool.query(
      `UPDATE org_members SET expires_at = now() - interval '1 day' WHERE org_id = $1 AND user_id = $2`,
      [camp, expired],
    );
    personId = (
      await pool.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name, email, date_of_birth, phone) VALUES ($1, 'Pat', 'Self', $2, '1985-06-15', '+1 555 0100') RETURNING id`,
        [camp, personEmail],
      )
    ).rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  const everyone = (): [string, string][] => [
    ...ROLES.map((r): [string, string] => [r, userOf(r)]),
    ['non-member', outsider],
    ['expired member', expired],
  ];
  const isWriter = (label: string): boolean => label === 'admin' || label === 'owner';

  describe('audit_log', () => {
    it('is readable by an admin and an owner only; every member can still write', async () => {
      await pool.query(
        `INSERT INTO audit_log (org_id, action, entity, entity_id) VALUES ($1, 'test.seed', 'camp', $2)`,
        [camp, camp],
      );
      for (const [label, id] of everyone()) {
        const rows = await as(id, db => db.query(`SELECT 1 FROM audit_log WHERE action = 'test.seed'`));
        expect(rows.rowCount, label).toBe(isWriter(label) ? 1 : 0);
      }
      for (const role of ROLES) {
        expect(
          await attempt(
            userOf(role),
            `INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id) VALUES ($1, $2, 'test.write', 'camp', $3)`,
            [camp, userOf(role), camp],
          ),
          role,
        ).toBe(1);
      }
      expect(
        await attempt(
          outsider,
          `INSERT INTO audit_log (org_id, action, entity, entity_id) VALUES ($1, 'test.write', 'camp', $2)`,
          [camp, camp],
        ),
      ).toBe('denied');
    });
  });

  describe('credentials', () => {
    it('INSERT and UPDATE are for an admin and an owner only; every member can read the other columns', async () => {
      for (const [label, id] of everyone()) {
        const inserted = await attempt(
          id,
          `INSERT INTO credentials (org_id, person_id, token_hash) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [camp, personId, randomBytes(32)],
        );
        if (isWriter(label)) {
          expect(inserted === 0 || inserted === 1, label).toBe(true);
        } else {
          expect(inserted, label).toBe('denied');
        }
      }
      await pool.query(`DELETE FROM credentials WHERE person_id = $1`, [personId]);
      await pool.query(`INSERT INTO credentials (org_id, person_id, token_hash) VALUES ($1, $2, $3)`, [
        camp,
        personId,
        randomBytes(32),
      ]);
      for (const [label, id] of everyone()) {
        const updated = await attempt(id, `UPDATE credentials SET issued_by = $2 WHERE person_id = $1`, [personId, id]);
        expect(updated === 'denied' ? 0 : updated, label).toBe(isWriter(label) ? 1 : 0);
        const read = await as(id, db =>
          db.query(`SELECT id, person_id, issued_at, issued_by, revoked_at, token_hash FROM credentials`),
        );
        expect(read.rowCount, label).toBe(label === 'non-member' || label === 'expired member' ? 0 : 1);
      }
    });

    it('the request role cannot read the ciphertext columns, whatever its role', async () => {
      for (const [label, id] of everyone()) {
        for (const sql of [
          'SELECT token_ciphertext FROM credentials',
          'SELECT token_iv FROM credentials',
          'SELECT token_auth_tag FROM credentials',
          'SELECT * FROM credentials',
        ]) {
          expect(await attempt(id, sql), `${label}: ${sql}`).toBe('denied');
        }
      }
      const grants = await pool.query<{ col: string; ok: boolean }>(
        `SELECT c AS col, has_column_privilege('buxa_app', 'credentials', c, 'SELECT') AS ok
           FROM unnest(ARRAY['token_ciphertext', 'token_iv', 'token_auth_tag', 'token_hash', 'revoked_at']) c`,
      );
      expect(grants.rows.filter(r => r.ok).map(r => r.col)).toEqual(['token_hash', 'revoked_at']);
    });
  });

  describe('buxa_reveal_badge', () => {
    let childId = '';
    let guardianUser = '';
    let strangerUser = '';
    let selfUser = '';
    const reveal = async (userId: string, person: string, org = camp): Promise<number> =>
      (await as(userId, db => db.query('SELECT credential_id FROM buxa_reveal_badge($1, $2)', [org, person]), org))
        .rowCount ?? 0;

    beforeAll(async () => {
      await pool.query(
        `UPDATE credentials SET token_ciphertext = decode(repeat('ab', 20), 'hex'), token_iv = decode(repeat('cd', 12), 'hex'),
                token_auth_tag = decode(repeat('ef', 16), 'hex') WHERE person_id = $1`,
        [personId],
      );
      childId = (
        await pool.query<{ id: string }>(
          `INSERT INTO people (org_id, given_name, family_name, date_of_birth, phone) VALUES ($1, 'Kid', 'Self', '2012-06-15', '+1 555 0100') RETURNING id`,
          [camp],
        )
      ).rows[0].id;
      await pool.query(`INSERT INTO credentials (org_id, person_id, token_hash) VALUES ($1, $2, $3)`, [
        camp,
        childId,
        randomBytes(32),
      ]);
      const guardianEmail = `guardian-${tag}@roster.test`;
      const guardianPerson = (
        await pool.query<{ id: string }>(
          `INSERT INTO people (org_id, given_name, family_name, email, date_of_birth, phone) VALUES ($1, 'Gus', 'Guardian', $2, '1985-06-15', '+1 555 0100') RETURNING id`,
          [camp, guardianEmail],
        )
      ).rows[0].id;
      const household = (
        await pool.query<{ id: string }>(`INSERT INTO households (org_id, name) VALUES ($1, 'Selfs') RETURNING id`, [
          camp,
        ])
      ).rows[0].id;
      await pool.query(
        `INSERT INTO household_members (org_id, household_id, person_id, relationship, is_guardian) VALUES
           ($1, $2, $3, 'parent', true), ($1, $2, $4, 'child', false)`,
        [camp, household, guardianPerson, childId],
      );
      const login = async (email: string): Promise<string> => {
        const id = (
          await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'Login') RETURNING id`, [email])
        ).rows[0].id;
        await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'viewer')`, [camp, id]);

        return id;
      };
      guardianUser = await login(guardianEmail);
      selfUser = await login(personEmail);
      strangerUser = await login(`stranger-${tag}@roster.test`);
    });

    it('shows the sealed copy to an admin and an owner', async () => {
      expect(await reveal(userOf('admin'), personId)).toBe(1);
      expect(await reveal(userOf('owner'), personId)).toBe(1);
      const sealed = await as(userOf('admin'), db =>
        db.query<{ sealed_iv: Buffer }>('SELECT sealed_iv FROM buxa_reveal_badge($1, $2)', [camp, personId]),
      );
      expect(sealed.rows[0].sealed_iv.length).toBe(12);
    });

    it('shows it to the person themself (by email) and to a guardian of the child, as a viewer', async () => {
      expect(await reveal(selfUser, personId)).toBe(1);
      expect(await reveal(guardianUser, childId)).toBe(1);
    });

    it('refuses staff, a teacher, a viewer with no link, a guardian for an adult, a non-member and an expired member', async () => {
      for (const id of [userOf('staff'), userOf('teacher'), userOf('viewer'), strangerUser, outsider, expired]) {
        expect(await reveal(id, personId)).toBe(0);
        expect(await reveal(id, childId)).toBe(0);
      }
      expect(await reveal(guardianUser, personId)).toBe(0);
      expect(await reveal(selfUser, childId)).toBe(0);
      expect(await reveal(outsider, personId, otherCamp)).toBe(0);
    });

    it('returns nothing for a revoked badge', async () => {
      await pool.query(`UPDATE credentials SET revoked_at = now() WHERE person_id = $1`, [childId]);
      expect(await reveal(userOf('owner'), childId)).toBe(0);
    });
  });

  describe('camp_calendar_tokens', () => {
    it('SELECT, INSERT and UPDATE are for an admin and an owner only', async () => {
      await pool.query(`INSERT INTO camp_calendar_tokens (org_id, token_hash) VALUES ($1, $2)`, [
        camp,
        randomBytes(32),
      ]);
      for (const [label, id] of everyone()) {
        expect(await attempt(id, `SELECT 1 FROM camp_calendar_tokens`), label).toBe(isWriter(label) ? 1 : 0);
        expect(
          await attempt(id, `UPDATE camp_calendar_tokens SET token_hash = $1 WHERE org_id = $2`, [
            randomBytes(32),
            camp,
          ]),
          label,
        ).toBe(isWriter(label) ? 1 : 0);
      }
      await pool.query(`DELETE FROM camp_calendar_tokens WHERE org_id = $1`, [camp]);
      for (const [label, id] of everyone()) {
        const insert = await attempt(id, `INSERT INTO camp_calendar_tokens (org_id, token_hash) VALUES ($1, $2)`, [
          camp,
          randomBytes(32),
        ]);
        if (isWriter(label)) {
          expect(insert, label).toBe(1);
          await pool.query(`DELETE FROM camp_calendar_tokens WHERE org_id = $1`, [camp]);
        } else {
          expect(insert, label).toBe('denied');
        }
      }
    });
  });

  describe('member_options and notifications', () => {
    it('member_options: a member reads their own, an admin or owner reads all, others and non-members read none', async () => {
      await pool.query(
        `INSERT INTO member_options (org_id, user_id, option_key, enabled) VALUES ($1, $2, 'teacher.check_in_out', true)`,
        [camp, userOf('teacher')],
      );
      for (const [label, id] of everyone()) {
        const expected = label === 'teacher' || isWriter(label) ? 1 : 0;
        expect(await attempt(id, `SELECT 1 FROM member_options`), label).toBe(expected);
      }
    });

    it('member_options: no role writes the table directly; the definer function works for an admin, not for a viewer', async () => {
      for (const [label, id] of everyone()) {
        expect(
          await attempt(
            id,
            `INSERT INTO member_options (org_id, user_id, option_key, enabled) VALUES ($1, $2, 'teacher.check_in_out', false)`,
            [camp, userOf('teacher')],
          ),
          label,
        ).toBe('denied');
      }
      expect(
        await attempt(userOf('admin'), `SELECT buxa_set_member_option($1, $2, 'teacher.check_in_out', false)`, [
          camp,
          userOf('teacher'),
        ]),
      ).toBe(1);
      expect(
        await attempt(userOf('viewer'), `SELECT buxa_set_member_option($1, $2, 'teacher.check_in_out', true)`, [
          camp,
          userOf('teacher'),
        ]),
      ).toBe('denied');
    });

    it('notifications_insert: any current member can write one in their camp; a non-member and an expired member cannot', async () => {
      for (const [label, id] of everyone()) {
        const member = label !== 'non-member' && label !== 'expired member';
        const result = await attempt(
          id,
          `INSERT INTO notifications (org_id, user_id, kind, title, link) VALUES ($1, $2, 'people', 'Hello', '/camp/people')`,
          [camp, member ? id : userOf('owner')],
        );
        expect(result, label).toBe(member ? 1 : 'denied');
      }
    });
  });

  describe('buxa_rename_member_v2 (migration 0058)', () => {
    let target = '';
    let targetPersonA = '';
    let targetPersonB = '';
    const rename = (userId: string, org: string, name: string) =>
      as(
        userId,
        db =>
          db.query<{ user_name: string }>('SELECT user_name FROM buxa_rename_member_v2($1, $2, $3)', [
            org,
            target,
            name,
          ]),
        org,
      );
    const names = async (): Promise<{ user: string; a: string; b: string }> => {
      const user = await pool.query<{ name: string }>('SELECT name FROM users WHERE id = $1', [target]);
      const person = async (id: string): Promise<string> =>
        (
          await pool.query<{ n: string }>(`SELECT given_name || ' ' || family_name AS n FROM people WHERE id = $1`, [
            id,
          ])
        ).rows[0].n;

      return { user: user.rows[0].name, a: await person(targetPersonA), b: await person(targetPersonB) };
    };

    beforeAll(async () => {
      target = await memberOf(pool, camp, 'viewer');
      await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'viewer')`, [
        otherCamp,
        target,
      ]);
      await pool.query(`UPDATE users SET name = 'Login Name' WHERE id = $1`, [target]);
      const person = async (org: string): Promise<string> =>
        (
          await pool.query<{ id: string }>(
            `INSERT INTO people (org_id, given_name, family_name, user_id, date_of_birth, phone) VALUES ($1, 'Old', 'Name', $2, '1985-06-15', '+1 555 0100') RETURNING id`,
            [org, target],
          )
        ).rows[0].id;
      targetPersonA = await person(camp);
      targetPersonB = await person(otherCamp);
    });

    it('an admin or owner renames the camp roster person and leaves users and the other camp alone', async () => {
      const result = await rename(userOf('admin'), camp, 'Rosa Maria Delgado');
      expect(result.rows).toEqual([{ user_name: 'Rosa Maria Delgado' }]);
      expect(await names()).toEqual({ user: 'Login Name', a: 'Rosa Maria Delgado', b: 'Old Name' });
      expect((await rename(userOf('owner'), camp, 'Madonna')).rows).toHaveLength(1);
      expect(await names()).toEqual({ user: 'Login Name', a: 'Madonna Madonna', b: 'Old Name' });
    });

    it('an admin of another camp changes only their own camp, never this one', async () => {
      expect((await rename(outsider, otherCamp, 'Cross Camp')).rows).toHaveLength(1);
      expect(await names()).toEqual({ user: 'Login Name', a: 'Madonna Madonna', b: 'Cross Camp' });
      expect((await rename(outsider, camp, 'Nope Nope')).rows).toHaveLength(0);
      expect((await names()).a).toBe('Madonna Madonna');
    });

    it('staff, a teacher, a viewer and an expired member get no row and change nothing', async () => {
      for (const id of [userOf('staff'), userOf('teacher'), userOf('viewer'), expired]) {
        expect((await rename(id, camp, 'Sneaky Name')).rows).toHaveLength(0);
      }
      expect((await names()).a).toBe('Madonna Madonna');
    });

    it('a member with no roster person is refused with a clear message', async () => {
      const bare = await memberOf(pool, camp, 'viewer');
      await expect(
        as(userOf('admin'), db =>
          db.query('SELECT * FROM buxa_rename_member_v2($1, $2, $3)', [camp, bare, 'No Person']),
        ),
      ).rejects.toThrow(/no person on the camp roster/);
    });
  });
});

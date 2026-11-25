import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '../src';

const url = process.env.DATABASE_URL;

// Migrations 0055 and 0056: terminal badges, registration keys, price snapshot, normalised names, unique email.
// The pool is the test login (it can bypass row-level security); withOrg runs as the restricted request role.
describe.skipIf(!url)('database integrity (0055, 0056)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(5).toString('hex');
  let org = '';
  let person = '';
  let sessionId = '';
  let classId = '';

  const one = async (sql: string, values: unknown[]): Promise<string> =>
    (await pool.query<{ id: string }>(sql, values)).rows[0].id;
  const newPerson = (label: string, email: string | null = null): Promise<string> =>
    one(`INSERT INTO people (org_id, given_name, family_name, email) VALUES ($1, $2, 'Test', $3) RETURNING id`, [
      org,
      label,
      email,
    ]);

  beforeAll(async () => {
    await migrate(pool);
    org = await one(`INSERT INTO orgs (name, slug) VALUES ('Integrity camp', $1) RETURNING id`, [`integrity-${tag}`]);
    person = await newPerson('Base');
    sessionId = await one(`INSERT INTO classes (org_id, name, default_capacity) VALUES ($1, $2, 10) RETURNING id`, [
      org,
      `Base session ${tag}`,
    ]);
    classId = await one(
      `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
       VALUES ($1, $2, '2027-07-05T09:00:00Z', '2027-07-05T12:00:00Z', 'Hall', 5, 8, 1) RETURNING id`,
      [org, sessionId],
    );
  });
  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = $1', [org]).catch(() => undefined);
    await pool.end();
  });

  describe('badges', () => {
    it('a revoked badge cannot be reactivated, and a revoked badge holds no sealed token', async () => {
      const id = await one(
        `INSERT INTO credentials (org_id, person_id, token_hash) VALUES ($1, $2, decode(repeat('cd', 32), 'hex')) RETURNING id`,
        [org, person],
      );
      await pool.query(`UPDATE credentials SET revoked_at = now() WHERE id = $1`, [id]);
      await expect(pool.query(`UPDATE credentials SET revoked_at = NULL WHERE id = $1`, [id])).rejects.toThrow(
        /revoked badge cannot be reactivated/,
      );
      await expect(
        pool.query(`UPDATE credentials SET revoked_at = now() + interval '1 day' WHERE id = $1`, [id]),
      ).rejects.toThrow(/revoked badge cannot be reactivated/);
    });

    it('the request role may update only the revoke and wipe columns', async () => {
      for (const [column, allowed] of [
        ['revoked_at', true],
        ['token_ciphertext', true],
        ['token_iv', true],
        ['token_auth_tag', true],
        ['token_hash', false],
        ['person_id', false],
        ['issued_at', false],
      ] as const) {
        const r = await pool.query<{ ok: boolean }>(
          `SELECT has_column_privilege('buxa_app', 'credentials', $1, 'UPDATE') AS ok`,
          [column],
        );
        expect(r.rows[0].ok, column).toBe(allowed);
      }
    });
  });

  describe('seat holds', () => {
    it('only the release columns are updatable by the request role', async () => {
      for (const [column, allowed] of [
        ['released_at', true],
        ['release_reason', true],
        ['expires_at', false],
        ['session_id', false],
        ['household_id', false],
        ['person_id', false],
      ] as const) {
        const r = await pool.query<{ ok: boolean }>(
          `SELECT has_column_privilege('buxa_app', 'seat_holds', $1, 'UPDATE') AS ok`,
          [column],
        );
        expect(r.rows[0].ok, column).toBe(allowed);
      }
    });

    it('a new active hold must name a child', async () => {
      const household = await one(`INSERT INTO households (org_id, name) VALUES ($1, 'No child') RETURNING id`, [org]);
      await expect(
        pool.query(
          `INSERT INTO seat_holds (org_id, session_id, household_id, expires_at) VALUES ($1, $2, $3, now() + interval '15 minutes')`,
          [org, classId, household],
        ),
      ).rejects.toMatchObject({ code: '23514', constraint: 'seat_holds_person_named' });
    });
  });

  describe('registration keys and price snapshot', () => {
    let formId = '';
    let registrationA = '';
    let registrationB = '';
    let enrolmentId = '';
    let holdId = '';

    beforeAll(async () => {
      formId = await one(`INSERT INTO registration_forms (org_id, name) VALUES ($1, 'Form') RETURNING id`, [org]);
      await pool.query(
        `INSERT INTO registration_form_versions (org_id, form_id, version, fields) VALUES ($1, $2, 1, '[]')`,
        [org, formId],
      );
      registrationA = await one(
        `INSERT INTO registrations (org_id, form_id, form_version, answers) VALUES ($1, $2, 1, '{}') RETURNING id`,
        [org, formId],
      );
      registrationB = await one(
        `INSERT INTO registrations (org_id, form_id, form_version, answers) VALUES ($1, $2, 1, '{}') RETURNING id`,
        [org, formId],
      );
      enrolmentId = await one(
        `INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled') RETURNING id`,
        [org, classId, person],
      );
      const household = await one(`INSERT INTO households (org_id, name) VALUES ($1, 'Keys') RETURNING id`, [org]);
      holdId = await one(
        `INSERT INTO seat_holds (org_id, session_id, household_id, person_id, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '15 minutes') RETURNING id`,
        [org, classId, household, await newPerson('Holder')],
      );
    });

    it('published_version must name a real version', async () => {
      await expect(
        pool.query(`UPDATE registration_forms SET published_version = 2 WHERE id = $1`, [formId]),
      ).rejects.toMatchObject({ code: '23503', constraint: 'registration_forms_published_version_fk' });
      await pool.query(`UPDATE registration_forms SET published_version = 1 WHERE id = $1`, [formId]);
      await pool.query(`UPDATE registration_forms SET published_version = NULL WHERE id = $1`, [formId]);
    });

    it('one registration place per enrolment and per hold', async () => {
      await pool.query(
        `INSERT INTO registration_classes (org_id, registration_id, class_id, person_id, enrolment_id, hold_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [org, registrationA, classId, person, enrolmentId, holdId],
      );
      await expect(
        pool.query(
          `INSERT INTO registration_classes (org_id, registration_id, class_id, person_id, enrolment_id) VALUES ($1, $2, $3, $4, $5)`,
          [org, registrationB, classId, person, enrolmentId],
        ),
      ).rejects.toMatchObject({ code: '23505', constraint: 'registration_classes_enrolment_key' });
      await expect(
        pool.query(
          `INSERT INTO registration_classes (org_id, registration_id, class_id, person_id, hold_id) VALUES ($1, $2, $3, $4, $5)`,
          [org, registrationB, classId, person, holdId],
        ),
      ).rejects.toMatchObject({ code: '23505', constraint: 'registration_classes_hold_key' });
    });

    it('a place records the price at submission, and a price needs its currency', async () => {
      const other = await newPerson('Priced');
      const row = await pool.query<{ price_minor: number; price_currency: string; early_bird_applied: boolean }>(
        `INSERT INTO registration_classes (org_id, registration_id, class_id, person_id, enrolment_id, price_minor, price_currency, early_bird_applied)
         VALUES ($1, $2, $3, $4, $5, 4500, 'USD', true) RETURNING price_minor, price_currency, early_bird_applied`,
        [
          org,
          registrationB,
          classId,
          other,
          await one(
            `INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'waitlisted') RETURNING id`,
            [org, classId, other],
          ),
        ],
      );
      expect(row.rows[0]).toEqual({ price_minor: 4500, price_currency: 'USD', early_bird_applied: true });
      await expect(
        pool.query(
          `INSERT INTO registration_classes (org_id, registration_id, class_id, person_id, hold_id, price_minor)
           VALUES ($1, $2, $3, $4, $5, 100)`,
          [org, registrationA, classId, await newPerson('Bad price'), holdId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
      // The snapshot cannot be changed by the request role.
      const ok = await pool.query<{ ok: boolean }>(
        `SELECT has_column_privilege('buxa_app', 'registration_classes', 'price_minor', 'UPDATE') AS ok`,
      );
      expect(ok.rows[0].ok).toBe(false);
    });
  });

  describe('names', () => {
    const insertSession = (name: string) =>
      pool.query(`INSERT INTO classes (org_id, name, default_capacity) VALUES ($1, $2, 10)`, [org, name]);

    it.each([
      ['a non-breaking space', 'Autumn Camp'],
      ['a zero-width space', 'Autumn​Camp'],
      ['an ideographic space', 'Autumn　Camp'],
      ['full-width letters', 'Ａutumn Camp'],
      ['extra spaces and case', '  autumn   CAMP '],
    ])('a session name with %s matches the plain name', async (_label, variant) => {
      const base = `Autumn Camp ${tag}`;
      const suffix = ` ${tag}`;
      await pool.query(`DELETE FROM classes WHERE org_id = $1 AND name = $2`, [org, base]);
      await insertSession(base);
      await expect(insertSession(variant + suffix)).rejects.toMatchObject({
        code: '23505',
        constraint: 'classes_org_name_normal_key',
      });
      await pool.query(`DELETE FROM classes WHERE org_id = $1 AND name = $2`, [org, base]);
    });

    it('group and room names in one session use the same rule', async () => {
      await pool.query(`INSERT INTO groups (org_id, session_id, name, capacity) VALUES ($1, $2, 'Red Team', 5)`, [
        org,
        sessionId,
      ]);
      await expect(
        pool.query(`INSERT INTO groups (org_id, session_id, name, capacity) VALUES ($1, $2, 'red team', 5)`, [
          org,
          sessionId,
        ]),
      ).rejects.toMatchObject({ code: '23505', constraint: 'groups_session_name_idx' });
      await pool.query(
        `INSERT INTO rooms (org_id, session_id, name, location, capacity) VALUES ($1, $2, 'Hall　A', 'Main', 5)`,
        [org, sessionId],
      );
      await expect(
        pool.query(
          `INSERT INTO rooms (org_id, session_id, name, location, capacity) VALUES ($1, $2, 'hall a', 'Main', 5)`,
          [org, sessionId],
        ),
      ).rejects.toMatchObject({ code: '23505', constraint: 'rooms_session_name_idx' });
    });
  });

  describe('people email', () => {
    it('an email is unique in a camp ignoring case and spaces, and a person with no email is not counted', async () => {
      await newPerson('Mail A', `Ann.${tag}@example.com`);
      await expect(newPerson('Mail B', ` ann.${tag}@EXAMPLE.com `)).rejects.toMatchObject({
        code: '23505',
        constraint: 'people_org_email_key',
      });
      await newPerson('No mail 1');
      await newPerson('No mail 2');
    });

    it('the same address can belong to a person in another camp', async () => {
      const other = await one(`INSERT INTO orgs (name, slug) VALUES ('Other', $1) RETURNING id`, [
        `integrity-o-${tag}`,
      ]);
      try {
        await pool.query(`INSERT INTO people (org_id, given_name, family_name, email) VALUES ($1, 'X', 'Y', $2)`, [
          other,
          `ann.${tag}@example.com`,
        ]);
      } finally {
        await pool.query('DELETE FROM orgs WHERE id = $1', [other]);
      }
    });
  });
});

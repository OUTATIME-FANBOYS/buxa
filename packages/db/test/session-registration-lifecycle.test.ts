import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate, withOrg } from '../src';
import { memberOf } from './support';

// Migrations 0053 and 0054: a session is a draft, live or archived; a draft is deleted with everything under it; a registration is
// erased with its answers by an admin or the owner. These need a real Postgres (DATABASE_URL).
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('session status and registration erasure (migrations 0053 and 0054)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const tag = randomBytes(6).toString('hex');
  let org = '';
  let otherOrg = '';
  let owner = '';
  let admin = '';
  let staff = '';
  let outsider = '';

  const newSession = async (orgId: string, name: string, status?: 'draft' | 'live' | 'archived'): Promise<string> =>
    (
      await pool.query<{ id: string }>(
        status
          ? `INSERT INTO classes (org_id, name, status) VALUES ($1, $2, $3) RETURNING id`
          : `INSERT INTO classes (org_id, name) VALUES ($1, $2) RETURNING id`,
        status ? [orgId, name, status] : [orgId, name],
      )
    ).rows[0].id;

  const addClass = async (orgId: string, sessionId: string, label: string): Promise<string> =>
    (
      await pool.query<{ id: string }>(
        `INSERT INTO sessions (org_id, class_id, name, age_min, age_max, starts_at, ends_at, location, capacity)
         VALUES ($1, $2, $3, 8, 12, '2027-07-05T09:00:00+10:00', '2027-07-05T12:00:00+10:00', 'Lab ' || gen_random_uuid(), 12)
         RETURNING id`,
        [orgId, sessionId, label],
      )
    ).rows[0].id;

  const person = async (orgId: string, given: string): Promise<string> =>
    (
      await pool.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name, date_of_birth, phone) VALUES ($1, $2, 'Tester', '1985-06-15', '+1 555 0100') RETURNING id`,
        [orgId, given],
      )
    ).rows[0].id;

  const count = async (sql: string, params: unknown[]): Promise<number> =>
    (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${sql}`, params)).rows[0].n;

  const deleteDraftAs = (userId: string, orgId: string, sessionId: string) =>
    withOrg(pool, userId, orgId, db =>
      db.query<{ deleted_class_id: string; deleted_class_name: string }>(
        'SELECT * FROM buxa_delete_draft_session_v1($1, $2)',
        [orgId, sessionId],
      ),
    );

  const deleteRegistrationAs = (userId: string, orgId: string, registrationId: string) =>
    withOrg(pool, userId, orgId, db => db.query('SELECT buxa_delete_registration_v1($1, $2)', [orgId, registrationId]));

  beforeAll(async () => {
    await migrate(pool);
    const slug = (label: string) => `${label}-${tag}`;
    org = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Lifecycle camp', $1) RETURNING id`, [
        slug('lifecycle'),
      ])
    ).rows[0].id;
    otherOrg = (
      await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Other camp', $1) RETURNING id`, [
        slug('lifecycle-other'),
      ])
    ).rows[0].id;
    owner = await memberOf(pool, org, 'owner');
    admin = await memberOf(pool, org, 'admin');
    staff = await memberOf(pool, org, 'staff');
    outsider = await memberOf(pool, otherOrg, 'admin');
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('session status column', () => {
    it('defaults a session written without a status to live (so a release that does not know the column still works)', async () => {
      const id = await newSession(org, `Default ${tag}`);
      const { rows } = await pool.query<{ status: string }>('SELECT status FROM classes WHERE id = $1', [id]);
      expect(rows[0].status).toBe('live');
    });

    it('refuses a status that is not draft, live or archived', async () => {
      await expect(newSession(org, `Odd ${tag}`, 'open' as 'live')).rejects.toMatchObject({
        code: '23514',
        constraint: 'classes_status_check',
      });
    });
  });

  describe('public pages show a live session only', () => {
    it('hides a draft and an archived session, and shows a live one', async () => {
      const slug = `public-status-${tag}`;
      const camp = (
        await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ('Public status', $1) RETURNING id`, [
          slug,
        ])
      ).rows[0].id;
      const sessionId = await newSession(camp, `Public ${tag}`, 'draft');
      await addClass(camp, sessionId, 'Robotics');
      await pool.query('UPDATE classes SET is_public = true WHERE id = $1', [sessionId]);
      const page = () =>
        withOrg(pool, null, null, db =>
          db.query('SELECT session_name FROM buxa_public_session($1, $2)', [slug, sessionId]),
        );
      const classes = () =>
        withOrg(pool, null, null, db =>
          db.query('SELECT class_name FROM buxa_public_classes_v2($1, $2, $3)', [
            slug,
            sessionId,
            new Date('2027-01-01'),
          ]),
        );

      expect((await page()).rows).toHaveLength(0);
      expect((await classes()).rows).toHaveLength(0);

      await pool.query(`UPDATE classes SET status = 'live' WHERE id = $1`, [sessionId]);
      expect((await page()).rows).toHaveLength(1);
      expect((await classes()).rows).toHaveLength(1);

      await pool.query(`UPDATE classes SET status = 'archived', archived_at = now() WHERE id = $1`, [sessionId]);
      expect((await page()).rows).toHaveLength(0);
      expect((await classes()).rows).toHaveLength(0);
    });
  });

  describe('delete a draft with everything under it', () => {
    it('removes the classes, groups, rooms, assignments, instructors and form links, and returns the classes', async () => {
      const sessionId = await newSession(org, `Draft all ${tag}`, 'draft');
      const first = await addClass(org, sessionId, 'Robotics');
      const second = await addClass(org, sessionId, 'Painting');
      const teacher = await person(org, 'Terry');
      await pool.query(`INSERT INTO session_instructors (org_id, session_id, person_id) VALUES ($1, $2, $3)`, [
        org,
        first,
        teacher,
      ]);
      const group = (
        await pool.query<{ id: string }>(
          `INSERT INTO groups (org_id, session_id, name, capacity) VALUES ($1, $2, 'Group A', 10) RETURNING id`,
          [org, sessionId],
        )
      ).rows[0].id;
      const room = (
        await pool.query<{ id: string }>(
          `INSERT INTO rooms (org_id, session_id, name, location, capacity) VALUES ($1, $2, 'Room 1', 'Main hall', 10) RETURNING id`,
          [org, sessionId],
        )
      ).rows[0].id;
      await pool.query(
        `INSERT INTO assignments (org_id, session_id, person_id, role, group_id, room_id) VALUES ($1, $2, $3, 'staff', $4, $5)`,
        [org, sessionId, teacher, group, room],
      );
      const form = (
        await pool.query<{ id: string }>(
          `INSERT INTO registration_forms (org_id, name, draft_name) VALUES ($1, 'Form', 'Form') RETURNING id`,
          [org],
        )
      ).rows[0].id;
      await pool.query(`INSERT INTO registration_form_sessions (org_id, form_id, session_id) VALUES ($1, $2, $3)`, [
        org,
        form,
        sessionId,
      ]);

      const result = await deleteDraftAs(admin, org, sessionId);

      expect(result.rows.map(r => r.deleted_class_id).sort()).toEqual([first, second].sort());
      expect(await count('classes WHERE id = $1', [sessionId])).toBe(0);
      expect(await count('sessions WHERE class_id = $1', [sessionId])).toBe(0);
      expect(await count('groups WHERE session_id = $1', [sessionId])).toBe(0);
      expect(await count('rooms WHERE session_id = $1', [sessionId])).toBe(0);
      expect(await count('assignments WHERE session_id = $1', [sessionId])).toBe(0);
      expect(await count('session_instructors WHERE session_id = ANY($1::uuid[])', [[first, second]])).toBe(0);
      expect(await count('registration_form_sessions WHERE session_id = $1', [sessionId])).toBe(0);
      // The instructor is a person of the camp, not part of the session: they stay.
      expect(await count('people WHERE id = $1', [teacher])).toBe(1);
    });

    it('lets the owner delete a draft, and refuses staff', async () => {
      const mine = await newSession(org, `Draft owner ${tag}`, 'draft');
      await deleteDraftAs(owner, org, mine);
      expect(await count('classes WHERE id = $1', [mine])).toBe(0);

      const kept = await newSession(org, `Draft staff ${tag}`, 'draft');
      await addClass(org, kept, 'Robotics');
      await expect(deleteDraftAs(staff, org, kept)).rejects.toMatchObject({ code: '42501' });
      expect(await count('classes WHERE id = $1', [kept])).toBe(1);
    });

    it('refuses a live session and an archived one, and deletes nothing', async () => {
      for (const status of ['live', 'archived'] as const) {
        const sessionId = await newSession(org, `Not draft ${status} ${tag}`, status);
        await addClass(org, sessionId, 'Robotics');
        await expect(deleteDraftAs(admin, org, sessionId)).rejects.toMatchObject({
          code: '23503',
          constraint: 'session_not_draft',
        });
        expect(await count('sessions WHERE class_id = $1', [sessionId])).toBe(1);
      }
    });

    it('does not reach another camp', async () => {
      const sessionId = await newSession(org, `Draft foreign ${tag}`, 'draft');
      await expect(deleteDraftAs(outsider, otherOrg, sessionId)).rejects.toMatchObject({ code: 'P0002' });
      expect(await count('classes WHERE id = $1', [sessionId])).toBe(1);
    });
  });

  describe('erase a registration', () => {
    let formId = '';

    const newRegistration = async (status: 'pending' | 'confirmed'): Promise<string> =>
      (
        await pool.query<{ id: string }>(
          `INSERT INTO registrations (org_id, form_id, form_version, answers, status, confirmed_at)
           VALUES ($1, $2, 1, '{"standard":{"camperFirstName":"Ada"},"custom":{}}'::jsonb, $3,
                   CASE WHEN $3 = 'confirmed' THEN now() ELSE NULL END)
           RETURNING id`,
          [org, formId, status],
        )
      ).rows[0].id;

    beforeAll(async () => {
      formId = (
        await pool.query<{ id: string }>(
          `INSERT INTO registration_forms (org_id, name, draft_name) VALUES ($1, 'Erase form', 'Erase form') RETURNING id`,
          [org],
        )
      ).rows[0].id;
      await pool.query(
        `INSERT INTO registration_form_versions (org_id, form_id, version, fields) VALUES ($1, $2, 1, '[]'::jsonb)`,
        [org, formId],
      );
    });

    it('lets an admin erase a registration and its places', async () => {
      const registrationId = await newRegistration('pending');
      const sessionId = await newSession(org, `Erase ${tag}`, 'live');
      const classId = await addClass(org, sessionId, 'Robotics');
      const child = await person(org, 'Kid');
      await pool.query(
        `INSERT INTO enrolments (org_id, session_id, person_id, status, cancelled_at) VALUES ($1, $2, $3, 'cancelled', now())`,
        [org, classId, child],
      );
      const enrolment = (await pool.query<{ id: string }>(`SELECT id FROM enrolments WHERE session_id = $1`, [classId]))
        .rows[0].id;
      await pool.query(
        `INSERT INTO registration_classes (org_id, registration_id, class_id, person_id, enrolment_id) VALUES ($1, $2, $3, $4, $5)`,
        [org, registrationId, classId, child, enrolment],
      );

      await deleteRegistrationAs(admin, org, registrationId);

      expect(await count('registrations WHERE id = $1', [registrationId])).toBe(0);
      expect(await count('registration_classes WHERE registration_id = $1', [registrationId])).toBe(0);
    });

    it('lets the owner erase, and refuses staff', async () => {
      const mine = await newRegistration('pending');
      await deleteRegistrationAs(owner, org, mine);
      expect(await count('registrations WHERE id = $1', [mine])).toBe(0);

      const kept = await newRegistration('pending');
      await expect(deleteRegistrationAs(staff, org, kept)).rejects.toMatchObject({ code: '42501' });
      expect(await count('registrations WHERE id = $1', [kept])).toBe(1);
    });

    it('refuses a registration that still has an active enrolment or an unreleased hold', async () => {
      const registrationId = await newRegistration('confirmed');
      const sessionId = await newSession(org, `Erase active ${tag}`, 'live');
      const classId = await addClass(org, sessionId, 'Robotics');
      const child = await person(org, 'Kid2');
      const enrolment = (
        await pool.query<{ id: string }>(
          `INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled') RETURNING id`,
          [org, classId, child],
        )
      ).rows[0].id;
      await pool.query(
        `INSERT INTO registration_classes (org_id, registration_id, class_id, person_id, enrolment_id) VALUES ($1, $2, $3, $4, $5)`,
        [org, registrationId, classId, child, enrolment],
      );

      await expect(deleteRegistrationAs(admin, org, registrationId)).rejects.toMatchObject({
        code: '23503',
        constraint: 'registration_has_enrolments',
      });
      expect(await count('registrations WHERE id = $1', [registrationId])).toBe(1);
      expect(await count('enrolments WHERE id = $1', [enrolment])).toBe(1);
    });

    it('does not reach another camp, and the request role has no direct DELETE', async () => {
      const registrationId = await newRegistration('pending');
      await expect(deleteRegistrationAs(outsider, otherOrg, registrationId)).rejects.toMatchObject({ code: 'P0002' });
      await expect(
        withOrg(pool, admin, org, db => db.query('DELETE FROM registrations WHERE id = $1', [registrationId])),
      ).rejects.toMatchObject({ code: '42501' });
      expect(await count('registrations WHERE id = $1', [registrationId])).toBe(1);
    });
  });
});

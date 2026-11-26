import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import { PgRegistrationRepository } from './PgRegistrationRepository';
import { createRegistrationService, type RegistrationService } from './RegistrationService';
import { createRegistrationFixture, pgPeopleService, type RegistrationFixture } from './__tests__/registrationFixture';

const url = process.env.DATABASE_URL;

// The camper's name and birth date are read from the child's record, so a blank answer is filled from it. One answer set then serves
// both children of the fixture (Ada and Ben).
const standard = {
  camperFirstName: '',
  camperLastName: '',
  camperBirthDate: '',
  guardianName: 'Byron Lovelace',
  guardianDateOfBirth: '1985-06-15',
  guardianPhone: '555-0100',
  emergencyContactName: 'Mary Somerville',
  emergencyContactPhone: '555-0111',
};

/*
 * Deleting a registration form in Postgres (migration 0070): the service and the database both refuse a form that a registration
 * names; a form with none is deleted with its versions and covered sessions (by the existing cascades), and the delete is audited in
 * the same transaction with no personal data. Needs DATABASE_URL.
 */
describe.skipIf(!url)('deleting a registration form in Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgRegistrationRepository(pool);
  // Confirmation is not part of these tests, so no badge is ever issued and the credentials factory is never called.
  const registration: RegistrationService = createRegistrationService(
    repo,
    () => {
      throw new Error('no badge expected in this test');
    },
    pgPeopleService(pool),
  );
  const tag = randomBytes(4).toString('hex');

  beforeAll(async () => {
    await migrate(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function publishedForm(): Promise<{ fx: RegistrationFixture; formId: string; admin: Actor; staff: Actor }> {
    const fx = await createRegistrationFixture(pool, `${tag}${randomBytes(3).toString('hex')}`);
    const admin = fx.actor('admin');
    const staff = fx.actor('staff');
    const form = await registration.createForm(admin, {
      name: 'Summer',
      sessionIds: [fx.sessionId],
      fields: [],
    });
    await registration.publishForm(admin, form.id);

    return { fx, formId: form.id, admin, staff };
  }

  const count = async (fx: RegistrationFixture, text: string, params: unknown[]) =>
    (await withOrg(pool, fx.userId, fx.orgId, db => db.query<{ n: string }>(text, params))).rows[0].n;

  const deleteAudits = (fx: RegistrationFixture, formId: string) =>
    withOrg(pool, fx.userId, fx.orgId, db =>
      db.query<{ data: unknown }>(
        `SELECT data FROM audit_log WHERE action = 'registration_form.delete' AND entity_id = $1`,
        [formId],
      ),
    );

  it('deletes a form that has no registrations, with its versions and covered sessions, and audits it', async () => {
    const { fx, formId, admin } = await publishedForm();

    await registration.deleteForm(admin, formId);

    expect(await count(fx, 'SELECT count(*) AS n FROM registration_forms WHERE id = $1', [formId])).toBe('0');
    expect(await count(fx, 'SELECT count(*) AS n FROM registration_form_versions WHERE form_id = $1', [formId])).toBe(
      '0',
    );
    expect(await count(fx, 'SELECT count(*) AS n FROM registration_form_sessions WHERE form_id = $1', [formId])).toBe(
      '0',
    );
    const audits = await deleteAudits(fx, formId);
    expect(audits.rows).toHaveLength(1);
  });

  it('writes the audit row with the form name only: no answers, no names of people', async () => {
    const { fx, formId, admin } = await publishedForm();

    await registration.deleteForm(admin, formId);

    const audits = await deleteAudits(fx, formId);
    expect(audits.rows[0].data).toEqual({ name: 'Summer' });
    expect(JSON.stringify(audits.rows[0].data)).not.toMatch(/Ada|Lovelace|Byron|555-/);
  });

  it('refuses a form that a registration names, in any status, and deletes nothing and writes no delete audit', async () => {
    const { fx, formId, admin, staff } = await publishedForm();
    const id = await registration.submit(staff, formId, {
      formId,
      selections: [{ camperId: fx.children.ada, classId: fx.classes.archery }],
      standard,
      custom: {},
    });
    await registration.archive(staff, id);

    await expect(registration.deleteForm(admin, formId)).rejects.toMatchObject({
      kind: 'registration-refused',
      reason: 'form_has_registrations',
      message: 'This form has registrations, so it cannot be deleted.',
    });

    expect(await count(fx, 'SELECT count(*) AS n FROM registration_forms WHERE id = $1', [formId])).toBe('1');
    expect((await deleteAudits(fx, formId)).rows).toHaveLength(0);
  });

  it('the database refuses the same delete on its own when a registration names the form (migration 0070 backstop)', async () => {
    const { fx, formId, admin, staff } = await publishedForm();
    await registration.submit(staff, formId, {
      formId,
      selections: [{ camperId: fx.children.ada, classId: fx.classes.archery }],
      standard,
      custom: {},
    });

    await expect(
      withOrg(pool, admin.userId, admin.orgId, db =>
        db.query('SELECT buxa_delete_registration_form_v1($1, $2)', [admin.orgId, formId]),
      ),
    ).rejects.toMatchObject({ constraint: 'registration_form_has_registrations' });
    expect(await count(fx, 'SELECT count(*) AS n FROM registration_forms WHERE id = $1', [formId])).toBe('1');
  });

  it('the database also refuses staff, who may not manage forms (the function checks the role)', async () => {
    const { fx, formId } = await publishedForm();
    // A login that is really a staff member of the camp. The fixture's own login is the admin, so it cannot stand in for staff here.
    const staffUser = (
      await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'Staff only') RETURNING id`, [
        `staff-${randomBytes(6).toString('hex')}@reg.test`,
      ])
    ).rows[0].id;
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'staff')`, [fx.orgId, staffUser]);

    await expect(
      withOrg(pool, staffUser, fx.orgId, db =>
        db.query('SELECT buxa_delete_registration_form_v1($1, $2)', [fx.orgId, formId]),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    expect(await count(fx, 'SELECT count(*) AS n FROM registration_forms WHERE id = $1', [formId])).toBe('1');
  });
});

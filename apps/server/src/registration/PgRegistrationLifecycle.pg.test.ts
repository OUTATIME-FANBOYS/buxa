import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import { PgRegistrationRepository } from './PgRegistrationRepository';
import { createRegistrationService, type RegistrationService } from './RegistrationService';
import { createRegistrationFixture, pgPeopleService, type RegistrationFixture } from './__tests__/registrationFixture';
import { createCredentialService } from '../services/credentials/createCredentialService';
import { createBadgeCipher, parseBadgeKey } from '../credentials/badgeCipher';
import { PgPeopleRepository } from '../people/PgPeopleRepository';
import { PgMembershipRepository } from '../memberships/PgMembershipRepository';
import { PgAttendanceRepository } from '../attendance/PgAttendanceRepository';
import { PgOrgRepository } from '../orgs/PgOrgRepository';
import { systemClock } from '../services/clock';
import { createClassService, type ClassService } from '../classes/ClassService';
import { PgClassRepository } from '../classes/PgClassRepository';

/** A fixed test key (32 bytes, base64). Never a real key. */
const TEST_KEY = Buffer.alloc(32, 3).toString('base64');
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
 * The session lifecycle and the registration lifecycle in Postgres (migrations 0053 and 0054): a draft or archived session takes no
 * registration or enrolment, going live opens it; a registration can be withdrawn (holds released, enrolments cancelled, record
 * kept), archived, or erased with its answers; registration_sessions is no longer written. Needs DATABASE_URL.
 */
describe.skipIf(!url)('session and registration lifecycle in Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgRegistrationRepository(pool);
  const registration: RegistrationService = createRegistrationService(
    repo,
    credentials =>
      createCredentialService({
        credentials,
        people: new PgPeopleRepository(pool),
        memberships: new PgMembershipRepository(pool),
        attendance: new PgAttendanceRepository(pool),
        orgs: new PgOrgRepository(pool),
        clock: systemClock,
        cipher: createBadgeCipher(() => parseBadgeKey(TEST_KEY)),
      }),
    pgPeopleService(pool),
  );
  const classes: ClassService = createClassService({
    repo: new PgClassRepository(pool),
    timezoneOf: () => Promise.resolve('UTC'),
  });
  const tag = randomBytes(4).toString('hex');

  beforeAll(async () => {
    await migrate(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function campWithForm(): Promise<{ fx: RegistrationFixture; formId: string; staff: Actor; admin: Actor }> {
    const fx = await createRegistrationFixture(pool, `${tag}${randomBytes(3).toString('hex')}`);
    const admin = fx.actor('admin');
    const staff = fx.actor('staff');
    const form = await registration.createForm(admin, {
      name: 'Summer',
      sessionIds: [fx.sessionId],
      fields: [],
    });
    await registration.publishForm(admin, form.id);

    return { fx, formId: form.id, staff, admin };
  }

  const pick = (camperId: string, classId: string) => ({ camperId, classId });
  const submit = (formId: string, actor: Actor, selections: { camperId: string; classId: string }[]) =>
    registration.submit(actor, formId, { formId, selections, standard, custom: {} });
  const rowsOf = (actor: Actor, formId: string) => registration.listSubmissions(actor, formId);
  const sql = <T extends pg.QueryResultRow>(fx: RegistrationFixture, text: string, params: unknown[] = []) =>
    withOrg(pool, fx.userId, fx.orgId, db => db.query<T>(text, params));
  const setStatus = (fx: RegistrationFixture, status: 'draft' | 'live' | 'archived') =>
    sql(fx, 'UPDATE classes SET status = $2 WHERE id = $1', [fx.sessionId, status]);
  const actionsOf = async (fx: RegistrationFixture) =>
    (await sql<{ action: string }>(fx, 'SELECT action FROM audit_log ORDER BY id')).rows.map(r => r.action);

  describe('a draft session', () => {
    it('refuses registration and enrolment; going live opens both', async () => {
      const { fx, formId, staff, admin } = await campWithForm();
      await setStatus(fx, 'draft');

      await expect(submit(formId, staff, [pick(fx.children.ada, fx.classes.archery)])).rejects.toMatchObject({
        kind: 'registration-refused',
        reason: 'session_not_open',
      });
      const refusedEnrol = await classes.enrol(admin, {
        classId: fx.classes.archery,
        camperId: fx.children.ada,
        waitlistIfFull: false,
      });
      expect(refusedEnrol).toMatchObject({ ok: false, failure: { reason: 'session_not_live' } });
      expect((await sql(fx, 'SELECT 1 FROM enrolments')).rowCount).toBe(0);
      expect((await sql(fx, 'SELECT 1 FROM registrations')).rowCount).toBe(0);

      // Staff cannot go live (classes:publish is admin and owner); an admin can.
      await expect(classes.publishSession(staff, fx.sessionId)).rejects.toMatchObject({ statusCode: 403 });
      const live = await classes.publishSession(admin, fx.sessionId);
      expect(live).toMatchObject({ ok: true, value: { status: 'live' } });
      expect(await actionsOf(fx)).toContain('session.publish');

      await expect(submit(formId, staff, [pick(fx.children.ada, fx.classes.archery)])).resolves.toEqual(
        expect.any(String),
      );
      const enrol = await classes.enrol(admin, {
        classId: fx.classes.painting,
        camperId: fx.children.ben,
        waitlistIfFull: false,
      });
      expect(enrol.ok).toBe(true);
    });

    it('a staff member creates a session as a draft (new sessions start as drafts)', async () => {
      const fx = await createRegistrationFixture(pool, `${tag}${randomBytes(3).toString('hex')}`);
      const made = await classes.createSession(fx.actor('staff'), {
        name: `New ${tag}-${randomBytes(3).toString('hex')}`,
        description: '',
        startsOn: '2027-07-01',
        endsOn: '2027-07-31',
      });
      expect(made).toMatchObject({ ok: true, value: { status: 'draft', archivedAt: null } });
    });
  });

  describe('an archived session', () => {
    it('refuses registration and enrolment, and unarchiving makes it live again', async () => {
      const { fx, formId, staff, admin } = await campWithForm();
      const archived = await classes.setSessionArchived(staff, fx.sessionId, true);
      expect(archived).toMatchObject({ ok: true, value: { status: 'archived' } });
      expect(archived.ok && archived.value.archivedAt).not.toBeNull();

      await expect(submit(formId, staff, [pick(fx.children.ada, fx.classes.archery)])).rejects.toMatchObject({
        reason: 'session_not_open',
      });
      const refused = await classes.enrol(admin, {
        classId: fx.classes.archery,
        camperId: fx.children.ada,
        waitlistIfFull: false,
      });
      expect(refused).toMatchObject({ ok: false, failure: { reason: 'session_not_live' } });
      // The session's classes are kept.
      expect((await sql(fx, 'SELECT 1 FROM sessions WHERE class_id = $1', [fx.sessionId])).rowCount).toBe(4);

      const back = await classes.setSessionArchived(admin, fx.sessionId, false);
      expect(back).toMatchObject({ ok: true, value: { status: 'live', archivedAt: null } });
      await expect(submit(formId, staff, [pick(fx.children.ada, fx.classes.archery)])).resolves.toEqual(
        expect.any(String),
      );
    });
  });

  describe('deleting a session', () => {
    it('a draft is deleted with everything under it after the typed name, and audited', async () => {
      const { fx, admin } = await campWithForm();
      await setStatus(fx, 'draft');
      await sql(fx, `INSERT INTO groups (org_id, session_id, name, capacity) VALUES ($1, $2, 'Group A', 10)`, [
        fx.orgId,
        fx.sessionId,
      ]);
      const name = (await sql<{ name: string }>(fx, 'SELECT name FROM classes WHERE id = $1', [fx.sessionId])).rows[0]
        .name;

      const impact = await classes.sessionDeleteImpact(admin, fx.sessionId);
      expect(impact).toMatchObject({ ok: true, value: { classes: 4, groups: 1, formLinks: 1 } });
      const wrong = await classes.deleteSessionWithClasses(admin, fx.sessionId, 'nope');
      expect(wrong).toMatchObject({ ok: false, failure: { reason: 'session_name_confirmation' } });
      expect((await sql(fx, 'SELECT 1 FROM classes WHERE id = $1', [fx.sessionId])).rowCount).toBe(1);

      const done = await classes.deleteSessionWithClasses(admin, fx.sessionId, name);
      expect(done.ok).toBe(true);
      for (const table of ['classes WHERE id', 'sessions WHERE class_id', 'groups WHERE session_id']) {
        expect((await sql(fx, `SELECT 1 FROM ${table} = $1`, [fx.sessionId])).rowCount).toBe(0);
      }
      expect(
        (await sql(fx, 'SELECT 1 FROM registration_form_sessions WHERE session_id = $1', [fx.sessionId])).rowCount,
      ).toBe(0);
      const audit = await sql<{ action: string; data: Record<string, unknown> }>(
        fx,
        `SELECT action, data FROM audit_log WHERE action IN ('session.delete', 'class.delete') ORDER BY id`,
      );
      expect(audit.rows.filter(r => r.action === 'class.delete')).toHaveLength(4);
      expect(audit.rows.find(r => r.action === 'session.delete')?.data).toMatchObject({
        name,
        status: 'draft',
        classes: 4,
        groups: 1,
      });
    });

    it('a live session with an enrolment is refused with the unenrol message, and nothing is deleted', async () => {
      const { fx, admin } = await campWithForm();
      const enrolled = await classes.enrol(admin, {
        classId: fx.classes.archery,
        camperId: fx.children.ada,
        waitlistIfFull: false,
      });
      expect(enrolled.ok).toBe(true);
      const name = (await sql<{ name: string }>(fx, 'SELECT name FROM classes WHERE id = $1', [fx.sessionId])).rows[0]
        .name;

      const refused = await classes.deleteSessionWithClasses(admin, fx.sessionId, name);

      expect(refused).toMatchObject({ ok: false, failure: { reason: 'session_has_enrolments' } });
      expect(!refused.ok && refused.failure.message).toContain('Unenrol every student first');
      expect((await sql(fx, 'SELECT 1 FROM classes WHERE id = $1', [fx.sessionId])).rowCount).toBe(1);
      expect((await sql(fx, 'SELECT 1 FROM enrolments')).rowCount).toBe(1);
    });
  });

  describe('registrations', () => {
    it('no longer writes registration_sessions, and still shows the session, derived from the places', async () => {
      const { fx, formId, staff } = await campWithForm();
      await submit(formId, staff, [
        pick(fx.children.ada, fx.classes.archery),
        pick(fx.children.ada, fx.classes.painting),
      ]);

      expect((await sql(fx, 'SELECT 1 FROM registration_sessions')).rowCount).toBe(0);
      const [row] = await rowsOf(staff, formId);
      expect(row.sessions.map(s => [s.sessionId, s.status])).toEqual([[fx.sessionId, 'submitted']]);
      expect(row.archivedAt).toBeNull();
      expect(row.withdrawnAt).toBeNull();
    });

    it('withdrawing a pending registration releases its holds and keeps the record', async () => {
      const { fx, formId, staff } = await campWithForm();
      await submit(formId, staff, [pick(fx.children.ada, fx.classes.archery)]);
      const [before] = await rowsOf(staff, formId);
      expect(before.classes[0].status).toBe('held');

      await registration.withdraw(staff, before.id);

      const [after] = await rowsOf(staff, formId);
      expect(after).toMatchObject({ id: before.id, status: 'withdrawn' });
      expect(after.withdrawnAt).not.toBeNull();
      expect(after.standard.camperFirstName).toBe('Ada');
      expect(after.classes[0].status).toBe('expired');
      expect((await sql(fx, 'SELECT 1 FROM seat_holds WHERE released_at IS NULL')).rowCount).toBe(0);
      expect(await actionsOf(fx)).toContain('registration.withdraw');
      await expect(registration.withdraw(staff, before.id)).rejects.toMatchObject({ reason: 'already_withdrawn' });
      await expect(registration.confirm(staff, before.id)).rejects.toMatchObject({ reason: 'not_pending' });
    });

    it('withdrawing a confirmed registration cancels its enrolments, and the waitlist moves up', async () => {
      const { fx, formId, staff } = await campWithForm();
      // Painting has one place: Ada takes it and is confirmed, Ben waits behind her.
      await submit(formId, staff, [pick(fx.children.ada, fx.classes.painting)]);
      await submit(formId, staff, [pick(fx.children.ben, fx.classes.painting)]);
      const adaRow = (await rowsOf(staff, formId)).find(r => r.classes[0].camperId === fx.children.ada);
      expect(adaRow).toBeDefined();
      await registration.confirm(staff, adaRow?.id ?? '');

      await registration.withdraw(staff, adaRow?.id ?? '');

      const rows = await rowsOf(staff, formId);
      const ada = rows.find(r => r.id === adaRow?.id);
      expect(ada).toMatchObject({ status: 'withdrawn' });
      expect(ada?.classes[0].status).toBe('cancelled');
      expect(ada?.confirmedAt).not.toBeNull();
      expect(rows.find(r => r.classes[0].camperId === fx.children.ben)?.classes[0].status).toBe('enrolled');
      const enrolments = await sql<{ status: string }>(fx, 'SELECT status FROM enrolments WHERE person_id = $1', [
        fx.children.ada,
      ]);
      expect(enrolments.rows.map(r => r.status)).toEqual(['cancelled']);
    });

    it('archiving hides nothing in the data, flags it, and unarchiving clears the flag', async () => {
      const { fx, formId, staff } = await campWithForm();
      await submit(formId, staff, [pick(fx.children.ada, fx.classes.archery)]);
      const [row] = await rowsOf(staff, formId);

      await registration.archive(staff, row.id);
      const [archived] = await rowsOf(staff, formId);
      expect(archived.archivedAt).not.toBeNull();
      expect(archived.status).toBe('pending');

      await registration.unarchive(staff, row.id);
      expect((await rowsOf(staff, formId))[0].archivedAt).toBeNull();
      expect(await actionsOf(fx)).toEqual(expect.arrayContaining(['registration.archive', 'registration.unarchive']));
    });

    it('delete erases the registration and its answers, with an audit row that holds no personal data', async () => {
      const { fx, formId, staff, admin } = await campWithForm();
      await submit(formId, staff, [pick(fx.children.ada, fx.classes.archery)]);
      const [row] = await rowsOf(staff, formId);

      await registration.erase(admin, row.id);

      expect(await rowsOf(staff, formId)).toEqual([]);
      expect((await sql(fx, 'SELECT 1 FROM registrations')).rowCount).toBe(0);
      expect((await sql(fx, 'SELECT 1 FROM registration_classes')).rowCount).toBe(0);
      // The pending registration's hold was given back, so the place is free again.
      expect((await sql(fx, 'SELECT 1 FROM seat_holds WHERE released_at IS NULL')).rowCount).toBe(0);
      const audit = await sql<{ data: unknown }>(fx, `SELECT data FROM audit_log WHERE action = 'registration.delete'`);
      expect(audit.rows).toHaveLength(1);
      const text = JSON.stringify(audit.rows[0].data);
      for (const personal of ['Ada', 'Lovelace', '555-0100', 'Byron', '2014-03-09']) {
        expect(text).not.toContain(personal);
      }
      // The answers are gone from every audit row too.
      const everything = JSON.stringify((await sql(fx, 'SELECT data FROM audit_log')).rows);
      expect(everything).not.toContain('Lovelace');
    });

    it('a confirmed registration with enrolments must be withdrawn before it is deleted', async () => {
      const { fx, formId, staff, admin } = await campWithForm();
      await submit(formId, staff, [pick(fx.children.ada, fx.classes.archery)]);
      const [row] = await rowsOf(staff, formId);
      await registration.confirm(staff, row.id);

      await expect(registration.erase(admin, row.id)).rejects.toMatchObject({ reason: 'withdraw_first' });
      expect((await sql(fx, 'SELECT 1 FROM registrations')).rowCount).toBe(1);

      await registration.withdraw(staff, row.id);
      await registration.erase(admin, row.id);
      expect((await sql(fx, 'SELECT 1 FROM registrations')).rowCount).toBe(0);
    });

    it('delete is for admin and owner only; staff and viewers are refused', async () => {
      const { fx, formId, staff } = await campWithForm();
      await submit(formId, staff, [pick(fx.children.ada, fx.classes.archery)]);
      const [row] = await rowsOf(staff, formId);
      const viewer: Actor = { userId: fx.userId, orgId: fx.orgId, role: 'viewer' };

      await expect(registration.erase(staff, row.id)).rejects.toMatchObject({ statusCode: 403 });
      await expect(registration.erase(viewer, row.id)).rejects.toMatchObject({ statusCode: 403 });
      await expect(registration.withdraw(viewer, row.id)).rejects.toMatchObject({ statusCode: 403 });
      await expect(registration.archive(viewer, row.id)).rejects.toMatchObject({ statusCode: 403 });
      expect((await sql(fx, 'SELECT 1 FROM registrations')).rowCount).toBe(1);
    });
  });
});

import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import { PgRegistrationRepository } from './PgRegistrationRepository';
import { createRegistrationService, type RegistrationService } from './RegistrationService';
import { RegistrationRefusedError } from './errors';
import { createRegistrationFixture, type RegistrationFixture } from './__tests__/registrationFixture';
import { createCredentialService } from '../services/credentials/createCredentialService';
import { createBadgeCipher, parseBadgeKey } from '../credentials/badgeCipher';
import { PgPeopleRepository } from '../people/PgPeopleRepository';
import { PgMembershipRepository } from '../memberships/PgMembershipRepository';
import { PgAttendanceRepository } from '../attendance/PgAttendanceRepository';
import { PgOrgRepository } from '../orgs/PgOrgRepository';
import { systemClock } from '../services/clock';
import { createClassService, type ClassService } from '../classes/ClassService';
import { PgClassRepository } from '../classes/PgClassRepository';
import { createSeatHoldService, type SeatHoldService } from '../holds/SeatHoldService';
import { PgSeatHoldRepository } from '../holds/PgSeatHoldRepository';

/** A fixed test key (32 bytes, base64). Never a real key. */
const TEST_KEY = Buffer.alloc(32, 3).toString('base64');
const url = process.env.DATABASE_URL;

const standard = {
  camperFirstName: 'Ada',
  camperLastName: 'Lovelace',
  camperBirthDate: '2014-03-09',
  guardianName: 'Byron Lovelace',
  guardianPhone: '555-0100',
  emergencyContactName: 'Mary Somerville',
  emergencyContactPhone: '555-0111',
};

/*
 * Registration by class in Postgres: a child's places are held (seat holds), a full class waitlists, confirmation creates the
 * enrolments and releases the holds, the expiry job frees a hold, and payment is recorded by hand. Each test has its own camp
 * (see registrationFixture.ts), so the classes start empty. Needs DATABASE_URL (docs/CONTRIBUTING.md).
 */
describe.skipIf(!url)('registration by class in Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgRegistrationRepository(pool);
  const registration: RegistrationService = createRegistrationService(repo, credentials =>
    createCredentialService({
      credentials,
      people: new PgPeopleRepository(pool),
      memberships: new PgMembershipRepository(pool),
      attendance: new PgAttendanceRepository(pool),
      orgs: new PgOrgRepository(pool),
      clock: systemClock,
      cipher: createBadgeCipher(() => parseBadgeKey(TEST_KEY)),
    }),
  );
  const classes: ClassService = createClassService({
    repo: new PgClassRepository(pool),
    timezoneOf: () => Promise.resolve('UTC'),
  });
  const seats: SeatHoldService = createSeatHoldService({
    repo: new PgSeatHoldRepository(pool),
    timezoneOf: () => Promise.resolve('UTC'),
  });
  const tag = randomBytes(4).toString('hex');

  beforeAll(async () => {
    await migrate(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  /** A camp with a published form covering its session, and the staff actor who records submissions. */
  async function campWithForm(): Promise<{ fx: RegistrationFixture; formId: string; staff: Actor; admin: Actor }> {
    const fx = await createRegistrationFixture(pool, `${tag}${randomBytes(3).toString('hex')}`);
    const admin = fx.actor('admin');
    const staff = fx.actor('staff');
    const form = await registration.createForm(admin, {
      name: 'Summer',
      season: 'Summer 2027',
      sessionIds: [fx.sessionId],
      fields: [],
    });
    await registration.publishForm(admin, form.id);

    return { fx, formId: form.id, staff, admin };
  }

  const pick = (camperId: string, classId: string) => ({ camperId, classId });
  const submit = (formId: string, actor: Actor, selections: { camperId: string; classId: string }[]) =>
    registration.submit(actor, formId, { formId, selections, standard, custom: {} });

  /** The registration rows of a form, as staff see them. */
  const rowsOf = async (actor: Actor, formId: string) => registration.listSubmissions(actor, formId);

  it('a child takes two classes whose times do not overlap: each gets a hold', async () => {
    const { fx, formId, staff } = await campWithForm();
    const id = await submit(formId, staff, [
      pick(fx.children.ada, fx.classes.archery),
      pick(fx.children.ada, fx.classes.painting),
    ]);

    const [row] = await rowsOf(staff, formId);
    expect(row.id).toBe(id);
    expect(row.classes.map(c => c.status).sort()).toEqual(['held', 'held']);
    expect(row.classes.map(c => c.paymentStatus)).toEqual(['unpaid', 'unpaid']);
    const holds = await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query<{ n: number }>(`SELECT count(*)::int AS n FROM seat_holds WHERE released_at IS NULL`),
    );
    expect(holds.rows[0].n).toBe(2);
  });

  it('overlapping classes for one child are refused, and no place is written', async () => {
    const { fx, formId, staff } = await campWithForm();
    await expect(
      submit(formId, staff, [pick(fx.children.ada, fx.classes.archery), pick(fx.children.ada, fx.classes.swimming)]),
    ).rejects.toMatchObject({ reason: 'classes_overlap' });

    expect(await rowsOf(staff, formId)).toEqual([]);
    const holds = await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query<{ n: number }>(`SELECT count(*)::int AS n FROM seat_holds`),
    );
    expect(holds.rows[0].n).toBe(0);
  });

  it('a full class puts the second family on its waitlist, and that family moves up when the seat frees', async () => {
    const { fx, formId, staff, admin } = await campWithForm();
    // Painting has one place. Ada's family takes it first; Ben's family joins the waitlist behind.
    await submit(formId, staff, [pick(fx.children.ada, fx.classes.painting)]);
    await submit(formId, staff, [pick(fx.children.ben, fx.classes.painting)]);
    const before = await rowsOf(staff, formId);
    const waiting = before.find(r => r.classes[0].camperId === fx.children.ben);
    expect(waiting?.classes[0].status).toBe('waitlisted');

    // Confirming Ada's registration turns her hold into an enrolment, so the place is taken. Cancelling that enrolment frees it.
    const ada = before.find(r => r.classes[0].camperId === fx.children.ada);
    expect(ada).toBeDefined();
    await registration.confirm(staff, ada?.id ?? '');
    const adaEnrolment = await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query<{ id: string }>(`SELECT enrolment_id AS id FROM registration_classes WHERE registration_id = $1`, [
        ada?.id ?? '',
      ]),
    );
    await classes.cancelEnrolment(admin, { enrolmentId: adaEnrolment.rows[0].id });

    const after = await rowsOf(staff, formId);
    expect(after.find(r => r.classes[0].camperId === fx.children.ben)?.classes[0].status).toBe('enrolled');
  });

  it('two families racing for the last place: one holds it, the other is waitlisted', async () => {
    const { fx, formId, staff } = await campWithForm();
    await Promise.all([
      submit(formId, staff, [pick(fx.children.ada, fx.classes.painting)]),
      submit(formId, staff, [pick(fx.children.ben, fx.classes.painting)]),
    ]);
    const statuses = (await rowsOf(staff, formId)).map(r => r.classes[0].status).sort();
    expect(statuses).toEqual(['held', 'waitlisted']);
  });

  it('confirmation creates one enrolment per held class and releases each hold as completed', async () => {
    const { fx, formId, staff } = await campWithForm();
    await submit(formId, staff, [
      pick(fx.children.ada, fx.classes.archery),
      pick(fx.children.ada, fx.classes.painting),
    ]);
    const [row] = await rowsOf(staff, formId);

    await registration.confirm(staff, row.id);

    const enrolments = await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query<{ status: string }>(`SELECT status FROM enrolments WHERE person_id = $1 ORDER BY created_at`, [
        fx.children.ada,
      ]),
    );
    expect(enrolments.rows.map(r => r.status)).toEqual(['enrolled', 'enrolled']);
    const holds = await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query<{ release_reason: string | null }>(`SELECT release_reason FROM seat_holds`),
    );
    expect(holds.rows.map(h => h.release_reason)).toEqual(['completed', 'completed']);
    const [confirmed] = await rowsOf(staff, formId);
    expect(confirmed.classes.map(c => c.status)).toEqual(['enrolled', 'enrolled']);
  });

  it('the expiry job still frees a hold that ran out before confirmation, and the place shows as expired', async () => {
    const { fx, formId, staff } = await campWithForm();
    await submit(formId, staff, [pick(fx.children.ada, fx.classes.archery)]);
    await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query(`UPDATE seat_holds SET expires_at = now() - interval '1 minute'`),
    );

    const sweep = await seats.releaseExpiredHoldsEverywhere();
    expect(sweep.released).toBeGreaterThanOrEqual(1);
    const [row] = await rowsOf(staff, formId);
    expect(row.classes[0].status).toBe('expired');
  });

  it('payment is unpaid by default, and staff mark it paid only with a note, which is kept', async () => {
    const { fx, formId, staff } = await campWithForm();
    await submit(formId, staff, [pick(fx.children.ada, fx.classes.painting)]);
    const [row] = await rowsOf(staff, formId);
    const place = row.classes[0];
    expect(place.paymentStatus).toBe('unpaid');

    await expect(registration.recordPayment(staff, place.id, { paid: true, note: null })).rejects.toMatchObject({
      kind: 'registration-invalid',
    });
    await registration.recordPayment(staff, place.id, { paid: true, note: 'Paid by cheque on 3 July' });
    const [paid] = await rowsOf(staff, formId);
    expect(paid.classes[0]).toMatchObject({ paymentStatus: 'paid', paymentNote: 'Paid by cheque on 3 July' });

    const audit = await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query<{ data: { hasNote: boolean } }>(`SELECT data FROM audit_log WHERE action = 'registration.payment'`),
    );
    expect(audit.rows[0].data.hasNote).toBe(true);
    expect(JSON.stringify(audit.rows[0].data)).not.toContain('cheque');
  });

  it('the request role has no hard delete on a registration class, and a viewer cannot submit or record a payment', async () => {
    const { fx, formId, staff } = await campWithForm();
    const viewer: Actor = { userId: fx.userId, orgId: fx.orgId, role: 'viewer' };
    await expect(submit(formId, viewer, [pick(fx.children.ada, fx.classes.archery)])).rejects.toMatchObject({
      statusCode: 403,
    });
    await submit(formId, staff, [pick(fx.children.ada, fx.classes.archery)]);
    const [row] = await rowsOf(staff, formId);
    await expect(
      registration.recordPayment(viewer, row.classes[0].id, { paid: false, note: null }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    const del = await pool.query<{ d: boolean }>(
      `SELECT has_table_privilege('buxa_app', 'registration_classes', 'DELETE') AS d`,
    );
    expect(del.rows[0].d).toBe(false);
  });

  it('a refused place (an unpublished form) writes nothing at all', async () => {
    const fx = await createRegistrationFixture(pool, `${tag}${randomBytes(3).toString('hex')}`);
    const staff = fx.actor('staff');
    const form = await registration.createForm(fx.actor('admin'), {
      name: 'Not yet',
      season: '',
      sessionIds: [fx.sessionId],
      fields: [],
    });
    await expect(submit(form.id, staff, [pick(fx.children.ada, fx.classes.archery)])).rejects.toBeInstanceOf(
      RegistrationRefusedError,
    );
    const count = await withOrg(pool, fx.userId, fx.orgId, db =>
      db.query<{ n: number }>(`SELECT count(*)::int AS n FROM registration_classes`),
    );
    expect(count.rows[0].n).toBe(0);
  });
});

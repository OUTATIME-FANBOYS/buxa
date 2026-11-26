import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import { PgRegistrationRepository } from './PgRegistrationRepository';
import { createRegistrationService } from './RegistrationService';
import { RegistrationRefusedError } from './errors';
import { createRegistrationFixture, pgPeopleService, type RegistrationFixture } from './__tests__/registrationFixture';
import { createCredentialService } from '../services/credentials/createCredentialService';
import { createBadgeCipher, parseBadgeKey } from '../credentials/badgeCipher';
import { PgPeopleRepository } from '../people/PgPeopleRepository';
import { PgMembershipRepository } from '../memberships/PgMembershipRepository';
import { PgAttendanceRepository } from '../attendance/PgAttendanceRepository';
import { PgOrgRepository } from '../orgs/PgOrgRepository';
import { systemClock } from '../services/clock';

/** A fixed test key (32 bytes, base64). Never a real key. */
const TEST_KEY = Buffer.alloc(32, 3).toString('base64');

const url = process.env.DATABASE_URL;

const standard = {
  camperFirstName: 'Ada',
  camperLastName: 'Lovelace',
  camperBirthDate: '2014-03-09',
  guardianName: 'Byron Lovelace',
  guardianDateOfBirth: '1979-11-02',
  guardianPhone: '555-0100',
  emergencyContactName: 'Mary Somerville',
  emergencyContactPhone: '555-0111',
};

// Registration forms and submissions in Postgres: a camp sees only its own forms, sessions, classes and submissions (row-level
// security), and a submission is written only when the rule allows it. Each camp comes from registrationFixture.ts.
describe.skipIf(!url)('registration in Postgres: camps are isolated', () => {
  const pool = new pg.Pool({ connectionString: url });
  const repo = new PgRegistrationRepository(pool);
  const service = createRegistrationService(
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
  let campA: RegistrationFixture;
  let campB: RegistrationFixture;
  let actorA: Actor;
  let actorB: Actor;

  beforeAll(async () => {
    await migrate(pool);
    campA = await createRegistrationFixture(pool);
    campB = await createRegistrationFixture(pool);
    actorA = campA.actor('admin');
    actorB = campB.actor('admin');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = ANY($1)', [[campA.orgId, campB.orgId]]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[campA.userId, campB.userId]]).catch(() => {});
    await pool.end();
  });

  const formInput = (sessionId: string) => ({
    name: 'Summer 2027',
    sessionIds: [sessionId],
    fields: [{ kind: 'yes_no' as const, key: 'photos', label: 'Photo consent', required: true }],
  });

  it('a form and its submission are visible only to their own camp', async () => {
    const form = await service.createForm(actorA, formInput(campA.sessionId));
    await service.publishForm(actorA, form.id);
    await service.submit(campA.actor('staff'), form.id, {
      formId: form.id,
      selections: [{ camperId: campA.children.ada, classId: campA.classes.climbing }],
      standard,
      custom: { photos: 'yes' },
    });

    expect(await repo.getForm(campB.userId, campB.orgId, form.id)).toBeNull();
    expect(await repo.getPublishedVersion(campB.userId, campB.orgId, form.id)).toBeNull();
    expect((await repo.listForms(campB.userId, campB.orgId)).map(f => f.id)).not.toContain(form.id);
    expect((await repo.listSubmissions(campA.userId, campA.orgId, form.id)).length).toBe(1);
    await expect(repo.listSubmissions(campB.userId, campB.orgId, form.id)).rejects.toMatchObject({
      kind: 'registration-form-not-found',
    });
  });

  it('a camp cannot register for another camp’s form or class', async () => {
    const form = await service.createForm(actorA, formInput(campA.sessionId));
    await service.publishForm(actorA, form.id);

    await expect(
      service.submit(actorB, form.id, {
        formId: form.id,
        selections: [{ camperId: campB.children.ben, classId: campB.classes.climbing }],
        standard,
        custom: { photos: 'no' },
      }),
    ).rejects.toMatchObject({ kind: 'registration-form-not-found' });
    await expect(service.createForm(actorB, formInput(campA.sessionId))).rejects.toMatchObject({
      kind: 'registration-session-not-found',
    });
  });

  it('row-level security hides another camp’s registration rows and places from a direct read', async () => {
    const form = await service.createForm(actorB, formInput(campB.sessionId));
    await service.publishForm(actorB, form.id);
    await service.submit(actorB, form.id, {
      formId: form.id,
      selections: [{ camperId: campB.children.ada, classId: campB.classes.climbing }],
      standard,
      custom: { photos: 'yes' },
    });

    const seenByA = await withOrg(pool, campA.userId, campA.orgId, db =>
      db.query<{ id: string }>('SELECT id FROM registrations WHERE form_id = $1', [form.id]),
    );
    expect(seenByA.rowCount).toBe(0);
    const placesSeenByA = await withOrg(pool, campA.userId, campA.orgId, db =>
      db.query<{ id: string }>('SELECT id FROM registration_classes WHERE class_id = $1', [campB.classes.climbing]),
    );
    expect(placesSeenByA.rowCount).toBe(0);
  });

  it('a refused registration writes nothing, and an unpublished form refuses', async () => {
    const form = await service.createForm(actorA, formInput(campA.sessionId));
    const before = await repo.listSubmissions(campA.userId, campA.orgId, form.id);
    await expect(
      service.submit(actorA, form.id, {
        formId: form.id,
        selections: [{ camperId: campA.children.ada, classId: campA.classes.archery }],
        standard,
        custom: { photos: 'yes' },
      }),
    ).rejects.toBeInstanceOf(RegistrationRefusedError);
    expect(await repo.listSubmissions(campA.userId, campA.orgId, form.id)).toEqual(before);
  });

  it('a registration is recorded pending, a staff member confirms it once, and both are audited', async () => {
    const staffA: Actor = { userId: campA.userId, orgId: campA.orgId, role: 'staff' };
    const form = await service.createForm(actorA, formInput(campA.sessionId));
    await service.publishForm(actorA, form.id);
    const id = await service.submit(staffA, form.id, {
      formId: form.id,
      selections: [{ camperId: campA.children.ben, classId: campA.classes.climbing }],
      standard,
      custom: { photos: 'yes' },
    });
    const [pending] = await repo.listSubmissions(campA.userId, campA.orgId, form.id);
    expect(pending).toMatchObject({ id, status: 'pending', confirmedAt: null });

    await service.confirm(staffA, id);
    await expect(service.confirm(staffA, id)).rejects.toMatchObject({ reason: 'already_confirmed' });

    const [confirmed] = await repo.listSubmissions(campA.userId, campA.orgId, form.id);
    expect(confirmed.status).toBe('confirmed');
    const audit = await withOrg(pool, campA.userId, campA.orgId, db =>
      db.query<{ action: string }>('SELECT action FROM audit_log WHERE entity_id = $1', [id]),
    );
    expect(audit.rows.map(r => r.action).sort()).toEqual(['registration.confirm', 'registration.submit']);
  });
});

import { describe, expect, it } from 'vitest';
import type { Actor, Role } from '@buxa/domain';
import { createRegistrationService } from './RegistrationService';
import { InMemoryRegistrationRepository } from './InMemoryRegistrationRepository';
import { InMemoryCredentialRepository } from '../credentials/InMemoryCredentialRepository';
import { InMemoryDatabase } from '../people/InMemoryDatabase';

/*
 * Deleting a registration form (in memory): only with registration:manage, and only when no registration names the form, in any
 * status. A refused delete writes nothing and says why. The Postgres side (the audit row, the cascade, the database backstop) is in
 * PgRegistrationFormDelete.pg.test.ts.
 */

const CAMP_A = '11111111-1111-4111-8111-111111111111';
const SESSION_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const CLASS_A3 = 'cccccccc-0000-4000-8000-00000000000c';
const CAMPER_ADA = '5e6f7a8b-1111-4a2b-8c3d-4e5f6a7b8c9d';
const CLASSES = {
  [CAMP_A]: [
    {
      classId: CLASS_A3,
      sessionId: SESSION_A,
      className: 'Painting',
      startsAt: '2027-07-10T13:00:00.000Z',
      endsAt: '2027-07-10T14:00:00.000Z',
    },
  ],
};

const as = (role: Role): Actor => ({ userId: `user-${role}`, orgId: CAMP_A, role });

const formInput = {
  name: 'Summer 2027',
  sessionIds: [SESSION_A],
  fields: [{ kind: 'yes_no', key: 'photos', label: 'Photo consent', required: true }],
};

const standard = {
  camperFirstName: 'Ada',
  camperLastName: 'Lovelace',
  camperBirthDate: '2014-03-09',
  guardianName: 'Byron Lovelace',
  guardianPhone: '555-0100',
  emergencyContactName: 'Mary Somerville',
  emergencyContactPhone: '555-0111',
};

function setup() {
  const repo = new InMemoryRegistrationRepository(
    { [CAMP_A]: [SESSION_A] },
    undefined,
    new InMemoryCredentialRepository(new InMemoryDatabase()),
    CLASSES,
  );
  // No badge is expected in these tests: the campers are not in the camp's people.
  const service = createRegistrationService(repo, () => {
    throw new Error('no badge expected in this test');
  });

  return { service };
}

/** A published form with one form-level registration, recorded by staff. Returns the form and the registration. */
async function formWithRegistration(service: ReturnType<typeof setup>['service']) {
  const admin = as('admin');
  const form = await service.createForm(admin, formInput);
  await service.publishForm(admin, form.id);
  const registrationId = await service.submit(as('staff'), form.id, {
    formId: form.id,
    selections: [{ camperId: CAMPER_ADA, classId: CLASS_A3 }],
    standard,
    custom: { photos: 'yes' },
  });

  return { formId: form.id, registrationId };
}

describe('deleting a registration form: permission', () => {
  it('staff and viewers are refused, and the form is still there', async () => {
    const { service } = setup();
    const form = await service.createForm(as('admin'), formInput);

    await expect(service.deleteForm(as('staff'), form.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.deleteForm(as('viewer'), form.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.listForms(as('admin'))).resolves.toHaveLength(1);
  });

  it('an admin and the owner may delete a form with no registrations', async () => {
    const { service } = setup();
    const first = await service.createForm(as('admin'), formInput);
    const second = await service.createForm(as('owner'), { ...formInput, name: 'Autumn 2027' });

    await expect(service.deleteForm(as('admin'), first.id)).resolves.toBeUndefined();
    await expect(service.deleteForm(as('owner'), second.id)).resolves.toBeUndefined();
  });
});

describe('deleting a registration form: the no-registrations rule', () => {
  it('deletes the form when no registration names it, and the table no longer lists it', async () => {
    const { service } = setup();
    const form = await service.createForm(as('admin'), formInput);

    await service.deleteForm(as('admin'), form.id);

    await expect(service.listForms(as('admin'))).resolves.toEqual([]);
  });

  it('refuses a form with a pending registration, and writes nothing', async () => {
    const { service } = setup();
    const { formId } = await formWithRegistration(service);

    await expect(service.deleteForm(as('admin'), formId)).rejects.toMatchObject({
      kind: 'registration-refused',
      reason: 'form_has_registrations',
      message: 'This form has registrations, so it cannot be deleted.',
    });
    await expect(service.listForms(as('admin'))).resolves.toHaveLength(1);
  });

  it('refuses a form whose registration is confirmed, withdrawn or archived', async () => {
    const { service } = setup();
    const { formId, registrationId } = await formWithRegistration(service);

    await service.confirm(as('staff'), registrationId);
    await expect(service.deleteForm(as('admin'), formId)).rejects.toMatchObject({ reason: 'form_has_registrations' });

    await service.withdraw(as('staff'), registrationId);
    await expect(service.deleteForm(as('admin'), formId)).rejects.toMatchObject({ reason: 'form_has_registrations' });

    await service.archive(as('staff'), registrationId);
    await expect(service.deleteForm(as('admin'), formId)).rejects.toMatchObject({ reason: 'form_has_registrations' });
    await expect(service.listForms(as('admin'))).resolves.toHaveLength(1);
  });

  it('refuses a form id that is not a uuid as not found, without touching anything', async () => {
    const { service } = setup();
    await service.createForm(as('admin'), formInput);

    await expect(service.deleteForm(as('admin'), 'not-a-form')).rejects.toMatchObject({
      kind: 'registration-form-not-found',
    });
    await expect(service.listForms(as('admin'))).resolves.toHaveLength(1);
  });
});

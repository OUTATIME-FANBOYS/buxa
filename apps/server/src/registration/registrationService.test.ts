import { describe, expect, it } from 'vitest';
import type { Actor, Role } from '@buxa/domain';
import { createRegistrationService } from './RegistrationService';
import { InMemoryRegistrationRepository } from './InMemoryRegistrationRepository';
import { RegistrationInvalidError, RegistrationRefusedError, RegistrationFormNotFoundError } from './errors';

const CAMP_A = '11111111-1111-4111-8111-111111111111';
const CAMP_B = '22222222-2222-4222-8222-222222222222';
const SESSION_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const SESSION_A2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const SESSION_B = 'bbbbbbbb-0000-4000-8000-000000000001';

const as = (role: Role, orgId = CAMP_A): Actor => ({ userId: `user-${role}`, orgId, role });

const formInput = {
  name: 'Summer 2027',
  season: 'Summer',
  sessionIds: [SESSION_A],
  fields: [
    { kind: 'choice', key: 'swim', label: 'Swim level', required: true, options: ['None', 'Beginner'] },
    { kind: 'yes_no', key: 'photos', label: 'Photo consent', required: true },
  ],
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
  const repo = new InMemoryRegistrationRepository({
    [CAMP_A]: [SESSION_A, SESSION_A2],
    [CAMP_B]: [SESSION_B],
  });

  return { repo, service: createRegistrationService(repo) };
}

describe('registration service: permissions', () => {
  it('a viewer cannot read forms or submissions, and cannot manage or submit', async () => {
    const { service } = setup();
    const owner = as('owner');
    const form = await service.createForm(owner, formInput);
    const viewer = as('viewer');

    await expect(service.listForms(viewer)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.listSubmissions(viewer, form.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.createForm(viewer, formInput)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.publishForm(viewer, form.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.submit(viewer, form.id, {})).rejects.toMatchObject({ statusCode: 403 });
  });

  it('staff can read and submit but not create or publish a form', async () => {
    const { service } = setup();
    const form = await service.createForm(as('admin'), formInput);
    const staff = as('staff');

    await expect(service.listForms(staff)).resolves.toHaveLength(1);
    await expect(service.createForm(staff, formInput)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.publishForm(staff, form.id)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('registration service: forms', () => {
  it('validates the form with the contract and reports field names', async () => {
    const { service } = setup();
    const bad = { ...formInput, fields: [{ ...formInput.fields[0], key: 'Swim Level' }] };
    await expect(service.createForm(as('admin'), bad)).rejects.toBeInstanceOf(RegistrationInvalidError);
  });

  it('refuses a session that is in another camp', async () => {
    const { service } = setup();
    await expect(service.createForm(as('admin'), { ...formInput, sessionIds: [SESSION_B] })).rejects.toMatchObject({
      kind: 'registration-session-not-found',
    });
  });

  it('a publish freezes the draft as version 1, and later edits do not change it', async () => {
    const { service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, formInput);
    expect(form.publishedVersion).toBeNull();

    const published = await service.publishForm(admin, form.id);
    expect(published.publishedVersion).toBe(1);

    await service.updateForm(admin, form.id, { ...formInput, name: 'Renamed' });
    const again = await service.publishForm(admin, form.id);
    expect(again.publishedVersion).toBe(2);
  });

  it('a form in another camp is not found', async () => {
    const { service } = setup();
    const form = await service.createForm(as('admin', CAMP_B), { ...formInput, sessionIds: [SESSION_B] });
    await expect(service.getForm(as('admin'), form.id)).rejects.toBeInstanceOf(RegistrationFormNotFoundError);
    await expect(service.listSubmissions(as('admin'), form.id)).rejects.toBeInstanceOf(RegistrationFormNotFoundError);
  });
});

describe('registration service: submissions', () => {
  async function publishedForm(sessionIds = [SESSION_A]) {
    const { repo, service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, { ...formInput, sessionIds });
    await service.publishForm(admin, form.id);

    return { repo, service, formId: form.id };
  }

  const submission = (formId: string, sessionIds: string[] = [SESSION_A]) => ({
    formId,
    sessionIds,
    standard,
    custom: { swim: 'Beginner', photos: 'yes', allergies: '  ' },
  });

  it('refuses a form that was never published, and writes nothing', async () => {
    const { service } = setup();
    const form = await service.createForm(as('admin'), formInput);
    await expect(service.submit(as('staff'), form.id, submission(form.id))).rejects.toBeInstanceOf(
      RegistrationRefusedError,
    );
    await expect(service.listSubmissions(as('staff'), form.id)).resolves.toEqual([]);
  });

  it('records a registration for one session, with the answers stored and blank optionals dropped', async () => {
    const { service, formId } = await publishedForm();
    const id = await service.submit(as('staff'), formId, submission(formId));

    const [row] = await service.listSubmissions(as('staff'), formId);
    expect(row.id).toBe(id);
    expect(row.formVersion).toBe(1);
    expect(row.standard.camperFirstName).toBe('Ada');
    expect(row.custom).toEqual({ swim: 'Beginner', photos: true });
  });

  it('records several sessions of one form under one registration', async () => {
    const { service, formId } = await publishedForm([SESSION_A, SESSION_A2]);
    await service.submit(as('staff'), formId, submission(formId, [SESSION_A, SESSION_A2]));
    const [row] = await service.listSubmissions(as('staff'), formId);
    expect(row.sessions.map(s => s.sessionId).sort()).toEqual([SESSION_A, SESSION_A2].sort());
  });

  it('refuses a session outside the form, and writes nothing', async () => {
    const { service, formId } = await publishedForm([SESSION_A]);
    await expect(service.submit(as('staff'), formId, submission(formId, [SESSION_A2]))).rejects.toMatchObject({
      reason: 'session_not_in_form',
    });
    await expect(service.listSubmissions(as('staff'), formId)).resolves.toEqual([]);
  });

  it('re-validates the answers on the server and reports the field that is wrong', async () => {
    const { service, formId } = await publishedForm();
    const bad = { ...submission(formId), standard: { ...standard, guardianPhone: '' }, custom: { photos: 'yes' } };
    const error = await service.submit(as('staff'), formId, bad).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RegistrationInvalidError);
    expect(Object.keys((error as RegistrationInvalidError).fieldErrors).sort()).toEqual([
      'custom.swim',
      'standard.guardianPhone',
    ]);
  });

  it('ignores a form id in the body that differs from the route, because the route id is used', async () => {
    const { service, formId } = await publishedForm();
    await expect(service.submit(as('staff'), formId, { ...submission(formId), formId: SESSION_B })).resolves.toEqual(
      expect.any(String),
    );
  });
});

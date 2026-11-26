import { describe, expect, it } from 'vitest';
import type { Actor, Role } from '@buxa/domain';
import { createRegistrationService } from './RegistrationService';
import { InMemoryRegistrationRepository } from './InMemoryRegistrationRepository';
import { InMemoryCredentialRepository } from '../credentials/InMemoryCredentialRepository';
import { adaFixture, benFixture, registrantPeople } from './__tests__/registrantPeople';
import { InMemoryDatabase } from '../people/InMemoryDatabase';
import {
  RegistrationClassNotFoundError,
  RegistrationFormNotFoundError,
  RegistrationInvalidError,
  RegistrationNotFoundError,
  RegistrationRefusedError,
} from './errors';

const CAMP_A = '11111111-1111-4111-8111-111111111111';
const CAMP_B = '22222222-2222-4222-8222-222222222222';
const SESSION_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const SESSION_A2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const SESSION_B = 'bbbbbbbb-0000-4000-8000-000000000001';
// Classes of the camp's sessions. CLASS_A1 and CLASS_A2 overlap in time; CLASS_A3 does not overlap CLASS_A1.
const CLASS_A1 = 'cccccccc-0000-4000-8000-00000000000a';
const CLASS_A2 = 'cccccccc-0000-4000-8000-00000000000b';
const CLASS_A3 = 'cccccccc-0000-4000-8000-00000000000c';
const CLASS_A4 = 'cccccccc-0000-4000-8000-00000000000d';
const CLASS_B = 'cccccccc-0000-4000-8000-00000000000e';
const CAMPER_ADA = '5e6f7a8b-1111-4a2b-8c3d-4e5f6a7b8c9d';
const CAMPER_BEN = '5e6f7a8b-2222-4a2b-8c3d-4e5f6a7b8c9d';
const GUARDIAN_ADA = '5e6f7a8b-3333-4a2b-8c3d-4e5f6a7b8c9d';
const GUARDIAN_BEN = '5e6f7a8b-4444-4a2b-8c3d-4e5f6a7b8c9d';
// Two series of days. Art has a day on each of two days (one choice for the family, one anchor per day); Swim starts after Art's
// first day but overlaps Art's second day.
const SERIES_ART = 'dddddddd-0000-4000-8000-00000000000a';
const SERIES_SWIM = 'dddddddd-0000-4000-8000-00000000000b';
const CLASS_ART_DAY1 = 'cccccccc-0000-4000-8000-0000000000a1';
const CLASS_ART_DAY2 = 'cccccccc-0000-4000-8000-0000000000a2';
const CLASS_SWIM_DAY1 = 'cccccccc-0000-4000-8000-0000000000b1';

/** A one-day class: its own series, with its only day as the series' occurrence. */
const lookup = (classId: string, sessionId: string, className: string, startsAt: string, endsAt: string) => ({
  classId,
  sessionId,
  className,
  startsAt,
  endsAt,
  seriesId: classId,
  occurrences: [{ startsAt, endsAt }],
});

type Day = readonly [startsAt: string, endsAt: string];
const ART_DAYS: readonly Day[] = [
  ['2027-07-10T10:00:00.000Z', '2027-07-10T11:00:00.000Z'],
  ['2027-07-11T10:00:00.000Z', '2027-07-11T11:00:00.000Z'],
];
const SWIM_DAYS: readonly Day[] = [
  ['2027-07-10T13:00:00.000Z', '2027-07-10T14:00:00.000Z'],
  ['2027-07-11T10:30:00.000Z', '2027-07-11T11:30:00.000Z'],
];

/**
 * The lookup of one day of a series: the day is the anchor the family's choice names (`anchorIndex` is the day it is made against),
 * and `occurrences` are all the series' days.
 */
const seriesDay = (classId: string, seriesId: string, className: string, days: readonly Day[], anchorIndex: number) => {
  const [startsAt, endsAt] = days[anchorIndex] ?? days[0];

  return {
    classId,
    sessionId: SESSION_A,
    className,
    startsAt,
    endsAt,
    seriesId,
    occurrences: days.map(([start, end]) => ({ startsAt: start, endsAt: end })),
  };
};

const CLASSES = {
  [CAMP_A]: [
    lookup(CLASS_A1, SESSION_A, 'Archery', '2027-07-10T10:00:00.000Z', '2027-07-10T11:00:00.000Z'),
    lookup(CLASS_A2, SESSION_A, 'Swimming', '2027-07-10T10:30:00.000Z', '2027-07-10T11:30:00.000Z'),
    lookup(CLASS_A3, SESSION_A, 'Painting', '2027-07-10T13:00:00.000Z', '2027-07-10T14:00:00.000Z'),
    lookup(CLASS_A4, SESSION_A2, 'Climbing', '2027-07-11T10:00:00.000Z', '2027-07-11T11:00:00.000Z'),
    seriesDay(CLASS_ART_DAY1, SERIES_ART, 'Art', ART_DAYS, 0),
    seriesDay(CLASS_ART_DAY2, SERIES_ART, 'Art', ART_DAYS, 1),
    seriesDay(CLASS_SWIM_DAY1, SERIES_SWIM, 'Swim', SWIM_DAYS, 0),
  ],
  [CAMP_B]: [lookup(CLASS_B, SESSION_B, 'Kayaking', '2027-07-10T10:00:00.000Z', '2027-07-10T11:00:00.000Z')],
};

/** `teacher` is a viewer whose person is an instructor (migration 0069): the teaching view. */
const as = (role: Role | 'teacher', orgId = CAMP_A): Actor =>
  role === 'teacher'
    ? { userId: `user-${role}`, orgId, role: 'viewer', instructor: true }
    : { userId: `user-${role}`, orgId, role };

const formInput = {
  name: 'Summer 2027',
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
  guardianDateOfBirth: '1979-11-02',
  guardianPhone: '555-0100',
};
/** Ben's answers: the camper's name and date of birth are his own, read from his record. */
const benStandard = { ...standard, camperFirstName: 'Ben', camperLastName: 'Carrow', camperBirthDate: '2013-05-01' };

/** These tests have no camper in their registrations, so no badge may be issued. */
function failNoBadges(): never {
  throw new Error('no badge expected in this test');
}

function setup() {
  const repo = new InMemoryRegistrationRepository(
    {
      [CAMP_A]: [SESSION_A, SESSION_A2],
      [CAMP_B]: [SESSION_B],
    },
    undefined,
    new InMemoryCredentialRepository(new InMemoryDatabase()),
    CLASSES,
  );

  const people = registrantPeople([adaFixture(CAMPER_ADA, GUARDIAN_ADA), benFixture(CAMPER_BEN, GUARDIAN_BEN)]);

  return { repo, service: createRegistrationService(repo, () => failNoBadges(), people) };
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

  /** One child (Ada) for each class named. */
  const submission = (formId: string, classIds: string[] = [CLASS_A3], camperId = CAMPER_ADA) => ({
    formId,
    selections: classIds.map(classId => ({ camperId, classId })),
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

  it('records a registration for a class, with the session taken from the class and blank optionals dropped', async () => {
    const { service, formId } = await publishedForm();
    const id = await service.submit(as('staff'), formId, submission(formId));

    const [row] = await service.listSubmissions(as('staff'), formId);
    expect(row.id).toBe(id);
    expect(row.formVersion).toBe(1);
    expect(row.standard.camperFirstName).toBe('Ada');
    expect(row.custom).toEqual({ swim: 'Beginner', photos: true });
  });

  it('records classes of two sessions of one form under one registration', async () => {
    const { service, formId } = await publishedForm([SESSION_A, SESSION_A2]);
    await service.submit(as('staff'), formId, submission(formId, [CLASS_A3, CLASS_A4]));
    const [row] = await service.listSubmissions(as('staff'), formId);
    expect(row.sessions.map(s => s.sessionId).sort()).toEqual([SESSION_A, SESSION_A2].sort());
    expect(row.classes.map(c => c.classId).sort()).toEqual([CLASS_A3, CLASS_A4].sort());
  });

  it('refuses a class whose session is outside the form, and writes nothing', async () => {
    const { service, formId } = await publishedForm([SESSION_A]);
    await expect(service.submit(as('staff'), formId, submission(formId, [CLASS_A4]))).rejects.toMatchObject({
      reason: 'session_not_in_form',
    });
    await expect(service.listSubmissions(as('staff'), formId)).resolves.toEqual([]);
  });

  it('lets one child take two classes whose times do not overlap', async () => {
    const { service, formId } = await publishedForm();
    await expect(service.submit(as('staff'), formId, submission(formId, [CLASS_A1, CLASS_A3]))).resolves.toEqual(
      expect.any(String),
    );
  });

  it('refuses one child two classes whose times overlap, names both, and writes nothing', async () => {
    const { service, formId } = await publishedForm();
    const error = await service
      .submit(as('staff'), formId, submission(formId, [CLASS_A1, CLASS_A2]))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RegistrationRefusedError);
    expect(error).toMatchObject({ reason: 'classes_overlap' });
    expect((error as Error).message).toContain('Archery');
    expect((error as Error).message).toContain('Swimming');
    await expect(service.listSubmissions(as('staff'), formId)).resolves.toEqual([]);
  });

  it('does not accept a changed camper name or date of birth: those come from the person record', async () => {
    const { service, formId } = await publishedForm();
    const changed = {
      ...submission(formId),
      standard: { ...standard, camperFirstName: 'Grace', camperBirthDate: '2010-01-01' },
    };
    const error = await service.submit(as('staff'), formId, changed).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RegistrationInvalidError);
    expect(Object.keys((error as RegistrationInvalidError).fieldErrors).sort()).toEqual([
      'standard.camperBirthDate',
      'standard.camperFirstName',
    ]);
  });

  it('allows two children to take overlapping classes, because each child is checked on their own', async () => {
    const { service, formId } = await publishedForm();
    const twoChildren = {
      ...submission(formId, [CLASS_A1]),
      selections: [
        { camperId: CAMPER_ADA, classId: CLASS_A1 },
        { camperId: CAMPER_BEN, classId: CLASS_A2 },
      ],
    };
    await expect(service.submit(as('staff'), formId, twoChildren)).resolves.toEqual(expect.any(String));
  });

  it('refuses the same class twice for one child', async () => {
    const { service, formId } = await publishedForm();
    await expect(service.submit(as('staff'), formId, submission(formId, [CLASS_A3, CLASS_A3]))).rejects.toMatchObject({
      reason: 'duplicate_selection',
    });
  });

  it('refuses a class that is not in this camp', async () => {
    const { service, formId } = await publishedForm();
    await expect(service.submit(as('staff'), formId, submission(formId, [CLASS_B]))).rejects.toBeInstanceOf(
      RegistrationClassNotFoundError,
    );
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

  it('refuses a parent or guardian with no date of birth, or no phone, with a field message and writes nothing', async () => {
    const { service, formId } = await publishedForm();
    const noBirth = { ...submission(formId), standard: { ...standard, guardianDateOfBirth: '' } };
    const noBirthError = await service.submit(as('staff'), formId, noBirth).catch((e: unknown) => e);
    expect(noBirthError).toBeInstanceOf(RegistrationInvalidError);
    expect((noBirthError as RegistrationInvalidError).fieldErrors['standard.guardianDateOfBirth']).toBe(
      'Enter the date of birth.',
    );

    const badPhone = { ...submission(formId), standard: { ...standard, guardianPhone: 'call me' } };
    const phoneError = await service.submit(as('staff'), formId, badPhone).catch((e: unknown) => e);
    expect((phoneError as RegistrationInvalidError).fieldErrors['standard.guardianPhone']).toBe(
      'Enter a phone number with at least 7 digits.',
    );
  });

  it('ignores a form id in the body that differs from the route, because the route id is used', async () => {
    const { service, formId } = await publishedForm();
    await expect(service.submit(as('staff'), formId, { ...submission(formId), formId: SESSION_B })).resolves.toEqual(
      expect.any(String),
    );
  });
});

describe('registration service: confirmation', () => {
  async function recorded() {
    const { service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, formInput);
    await service.publishForm(admin, form.id);
    const id = await service.submit(as('staff'), form.id, {
      formId: form.id,
      selections: [{ camperId: CAMPER_ADA, classId: CLASS_A3 }],
      standard,
      custom: { swim: 'Beginner', photos: 'yes' },
    });

    return { service, formId: form.id, id };
  }

  it('a recorded registration is pending until a staff member confirms it', async () => {
    const { service, formId, id } = await recorded();
    const [before] = await service.listSubmissions(as('staff'), formId);
    expect(before).toMatchObject({ id, status: 'pending', confirmedAt: null });

    await service.confirm(as('staff'), id);
    const [after] = await service.listSubmissions(as('staff'), formId);
    expect(after.status).toBe('confirmed');
    expect(after.confirmedAt).not.toBeNull();
  });

  it('staff can confirm', async () => {
    const { service, id } = await recorded();
    await expect(service.confirm(as('staff'), id)).resolves.toEqual({ badgesIssued: 0, badgeNote: null });
  });

  it('a viewer cannot confirm, and the registration stays pending', async () => {
    const { service, formId, id } = await recorded();
    await expect(service.confirm(as('viewer'), id)).rejects.toMatchObject({ statusCode: 403 });
    const [row] = await service.listSubmissions(as('staff'), formId);
    expect(row.status).toBe('pending');
  });

  it('a payment is recorded by staff: unpaid by default, and marked paid only with a note', async () => {
    const { service, formId } = await recorded();
    const [row] = await service.listSubmissions(as('staff'), formId);
    const place = row.classes[0];
    expect(place).toMatchObject({ status: 'held', paymentStatus: 'unpaid' });

    await expect(service.recordPayment(as('staff'), place.id, { paid: true, note: '  ' })).rejects.toBeInstanceOf(
      RegistrationInvalidError,
    );
    await service.recordPayment(as('staff'), place.id, { paid: true, note: 'Cheque 1042' });
    const [paid] = await service.listSubmissions(as('staff'), formId);
    expect(paid.classes[0]).toMatchObject({ paymentStatus: 'paid', paymentNote: 'Cheque 1042' });
  });

  it('a viewer cannot record a payment', async () => {
    const { service, formId } = await recorded();
    const [row] = await service.listSubmissions(as('staff'), formId);
    await expect(
      service.recordPayment(as('viewer'), row.classes[0].id, { paid: false, note: null }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('a second confirmation is refused', async () => {
    const { service, id } = await recorded();
    await service.confirm(as('staff'), id);
    await expect(service.confirm(as('staff'), id)).rejects.toMatchObject({
      kind: 'registration-refused',
      reason: 'already_confirmed',
    });
  });

  it('a registration in another camp, or an unknown id, is not found', async () => {
    const { service, id } = await recorded();
    await expect(service.confirm(as('staff', CAMP_B), id)).rejects.toBeInstanceOf(RegistrationNotFoundError);
    await expect(service.confirm(as('staff'), 'not-a-uuid')).rejects.toBeInstanceOf(RegistrationNotFoundError);
  });
});

describe('registration service: lifecycle (withdraw, archive, delete)', () => {
  async function withRegistration() {
    const { repo, service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, formInput);
    await service.publishForm(admin, form.id);
    const submit = () =>
      service.submit(as('staff'), form.id, {
        formId: form.id,
        selections: [{ camperId: CAMPER_ADA, classId: CLASS_A3 }],
        standard,
        custom: { swim: 'Beginner', photos: 'yes' },
      });
    const id = await submit();

    return { repo, service, formId: form.id, id, submit };
  }

  it('a session that is a draft or archived refuses a registration, and the refusal says so', async () => {
    const { repo, service, formId } = await withRegistration();
    repo.closedSessionIds.add(SESSION_A);

    await expect(
      service.submit(as('staff'), formId, {
        formId,
        selections: [{ camperId: CAMPER_BEN, classId: CLASS_A3 }],
        standard: benStandard,
        custom: { swim: 'Beginner', photos: 'yes' },
      }),
    ).rejects.toMatchObject({ kind: 'registration-refused', reason: 'session_not_open' });
    await expect(service.listSubmissions(as('staff'), formId)).resolves.toHaveLength(1);

    repo.closedSessionIds.delete(SESSION_A);
    await expect(
      service.submit(as('staff'), formId, {
        formId,
        selections: [{ camperId: CAMPER_BEN, classId: CLASS_A3 }],
        standard: benStandard,
        custom: { swim: 'Beginner', photos: 'yes' },
      }),
    ).resolves.toEqual(expect.any(String));
  });

  it('withdraw keeps the record, cancels its places, and a second withdraw is refused', async () => {
    const { service, formId, id } = await withRegistration();

    await service.withdraw(as('staff'), id);

    const [row] = await service.listSubmissions(as('staff'), formId);
    expect(row).toMatchObject({ id, status: 'withdrawn' });
    expect(row.withdrawnAt).not.toBeNull();
    expect(row.standard.camperFirstName).toBe('Ada');
    expect(row.classes.every(c => c.status !== 'held')).toBe(true);
    await expect(service.withdraw(as('staff'), id)).rejects.toMatchObject({ reason: 'already_withdrawn' });
  });

  it('a withdrawn registration cannot be confirmed', async () => {
    const { service, id } = await withRegistration();
    await service.withdraw(as('staff'), id);
    await expect(service.confirm(as('staff'), id)).rejects.toMatchObject({ reason: 'not_pending' });
  });

  it('archive flags the registration and unarchive clears it; it is kept either way', async () => {
    const { service, formId, id } = await withRegistration();

    await service.archive(as('staff'), id);
    expect((await service.listSubmissions(as('staff'), formId))[0].archivedAt).not.toBeNull();

    await service.unarchive(as('staff'), id);
    expect((await service.listSubmissions(as('staff'), formId))[0].archivedAt).toBeNull();
  });

  it('delete erases the registration with its answers, for an admin and for the owner', async () => {
    const { service, formId, id, submit } = await withRegistration();
    await service.erase(as('admin'), id);
    await expect(service.listSubmissions(as('staff'), formId)).resolves.toEqual([]);

    const second = await submit();
    await service.erase(as('owner'), second);
    await expect(service.listSubmissions(as('staff'), formId)).resolves.toEqual([]);
  });

  it('delete is refused for staff, a viewer and a teacher, and the registration stays', async () => {
    const { service, formId, id } = await withRegistration();
    for (const role of ['staff', 'viewer', 'teacher'] as const) {
      await expect(service.erase(as(role), id)).rejects.toMatchObject({ statusCode: 403 });
    }
    await expect(service.listSubmissions(as('staff'), formId)).resolves.toHaveLength(1);
  });

  it('withdraw and archive are for staff and above: a viewer and a teacher are refused', async () => {
    const { service, id } = await withRegistration();
    for (const role of ['viewer', 'teacher'] as const) {
      await expect(service.withdraw(as(role), id)).rejects.toMatchObject({ statusCode: 403 });
      await expect(service.archive(as(role), id)).rejects.toMatchObject({ statusCode: 403 });
      await expect(service.unarchive(as(role), id)).rejects.toMatchObject({ statusCode: 403 });
    }
  });

  it('a registration of another camp, or a malformed id, is not found', async () => {
    const { service, id } = await withRegistration();
    await expect(service.withdraw(as('admin', CAMP_B), id)).rejects.toBeInstanceOf(RegistrationNotFoundError);
    await expect(service.erase(as('admin'), 'not-a-uuid')).rejects.toBeInstanceOf(RegistrationNotFoundError);
  });
});

describe('registration service: a child takes one place per series', () => {
  async function formWithSessionA() {
    const { repo, service } = setup();
    const admin = as('admin');
    const form = await service.createForm(admin, { ...formInput, sessionIds: [SESSION_A] });
    await service.publishForm(admin, form.id);

    return { repo, service, formId: form.id };
  }

  /** Each named series day is one selection; `camperId` defaults to Ada. */
  const choose = (formId: string, classIds: string[], camperId = CAMPER_ADA) => ({
    formId,
    selections: classIds.map(classId => ({ camperId, classId })),
    standard,
    custom: { swim: 'Beginner', photos: 'yes' },
  });

  it('records one place per child per series, on the series anchor day', async () => {
    const { service, formId } = await formWithSessionA();
    await service.submit(as('staff'), formId, choose(formId, [CLASS_ART_DAY1]));

    const [row] = await service.listSubmissions(as('staff'), formId);
    expect(row.classes.map(c => c.classId)).toEqual([CLASS_ART_DAY1]);
  });

  it('refuses one series twice for one child, even when the two selections name different days of it', async () => {
    const { service, formId } = await formWithSessionA();
    await expect(
      service.submit(as('staff'), formId, choose(formId, [CLASS_ART_DAY1, CLASS_ART_DAY2])),
    ).rejects.toMatchObject({
      reason: 'duplicate_selection',
    });
    await expect(service.listSubmissions(as('staff'), formId)).resolves.toEqual([]);
  });

  it('lets two children each take the same series once', async () => {
    const { service, formId } = await formWithSessionA();
    const both = {
      ...choose(formId, [CLASS_ART_DAY1]),
      selections: [
        { camperId: CAMPER_ADA, classId: CLASS_ART_DAY1 },
        { camperId: CAMPER_BEN, classId: CLASS_ART_DAY1 },
      ],
    };
    await service.submit(as('staff'), formId, both);

    const [row] = await service.listSubmissions(as('staff'), formId);
    expect(row.classes).toHaveLength(2);
  });

  it('refuses two series whose days overlap on a later day, though their first days do not clash', async () => {
    const { service, formId } = await formWithSessionA();
    const error = await service
      .submit(as('staff'), formId, choose(formId, [CLASS_ART_DAY1, CLASS_SWIM_DAY1]))
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ reason: 'classes_overlap' });
    expect((error as Error).message).toContain('Art');
    expect((error as Error).message).toContain('Swim');
    await expect(service.listSubmissions(as('staff'), formId)).resolves.toEqual([]);
  });
});

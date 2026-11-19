import { describe, expect, it } from 'vitest';
import { isHttpError } from '../http/errors';
import {
  CAMPER_ADA,
  CAMPER_BEN,
  JULY_SESSION,
  ORG,
  OTHER_ORG,
  as,
  classAt,
  classWithSession,
  monday9to12,
  painting,
  robotics,
  setup,
} from './__tests__/fixtures';

const expect403 = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isHttpError(err) && err.statusCode).toBe(403);
};

describe('class service: permissions (role x method)', () => {
  it('viewers may read sessions, classes and enrolments, and create, edit or delete nothing', async () => {
    const { service } = setup();
    const { classId, sessionId } = await classWithSession(service);
    const viewer = as('viewer');
    expect((await service.listSessions(viewer)).ok).toBe(true);
    expect((await service.getSession(viewer, sessionId)).ok).toBe(true);
    expect((await service.listClasses(viewer, sessionId)).ok).toBe(true);
    expect((await service.getClass(viewer, classId)).ok).toBe(true);
    expect((await service.listEnrolments(viewer, classId)).ok).toBe(true);
    await expect403(service.createSession(viewer, JULY_SESSION));
    await expect403(service.addClass(viewer, sessionId, classAt(robotics, monday9to12)));
    await expect403(service.updateClass(viewer, classId, classAt(robotics, monday9to12)));
    await expect403(service.deleteClass(viewer, classId));
    await expect403(service.enrol(viewer, { classId, camperId: CAMPER_ADA, waitlistIfFull: false }));
  });

  it('a viewer cannot cancel an enrolment either', async () => {
    const { service } = setup();
    const { classId } = await classWithSession(service);
    const enrolled = await service.enrol(as('staff'), { classId, camperId: CAMPER_ADA, waitlistIfFull: false });
    if (!enrolled.ok) {
      throw new Error('setup failed');
    }
    await expect403(service.cancelEnrolment(as('viewer'), { enrolmentId: enrolled.value.id }));
  });

  it('staff may create sessions, add, edit and delete classes, enrol and cancel', async () => {
    const { service } = setup();
    const staff = as('staff');
    const session = await service.createSession(staff, JULY_SESSION);
    expect(session.ok).toBe(true);
    if (!session.ok) {
      return;
    }
    const added = await service.addClass(staff, session.value.id, classAt(robotics, monday9to12));
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    expect((await service.updateClass(staff, added.value.id, classAt(robotics, monday9to12))).ok).toBe(true);
    const enrolled = await service.enrol(staff, {
      classId: added.value.id,
      camperId: CAMPER_ADA,
      waitlistIfFull: false,
    });
    expect(enrolled.ok).toBe(true);
    if (!enrolled.ok) {
      return;
    }
    expect((await service.cancelEnrolment(staff, { enrolmentId: enrolled.value.id })).ok).toBe(true);
    // The cancelled enrolment still exists, so the class cannot be deleted yet.
    expect((await service.deleteClass(staff, added.value.id)).ok).toBe(false);
  });

  it('a camp another organisation cannot see its sessions, and a missing one is a clear failure', async () => {
    const { service } = setup();
    const { sessionId, classId } = await classWithSession(service);
    const outsider = as('owner', OTHER_ORG);
    expect(await service.listSessions(outsider)).toEqual({ ok: true, value: [] });
    expect(await service.getSession(outsider, sessionId)).toMatchObject({
      ok: false,
      failure: { reason: 'session_not_found' },
    });
    expect(await service.getClass(outsider, classId)).toMatchObject({
      ok: false,
      failure: { reason: 'class_not_found' },
    });
  });
});

describe('class service: sessions and classes', () => {
  it('stores a session with its name, description and date range, and returns them', async () => {
    const { service } = setup();
    const created = await service.createSession(as('admin'), JULY_SESSION);
    expect(created).toMatchObject({
      ok: true,
      value: {
        name: 'Summer camp',
        description: 'Two weeks in July.',
        startsOn: '2027-07-01',
        endsOn: '2027-07-31',
        classCount: 0,
      },
    });
  });

  it('a class is stored with its own name, ages, camp size, time range and location', async () => {
    const { service } = setup();
    const { sessionId, classId } = await classWithSession(service);
    const cls = await service.getClass(as('viewer'), classId);
    expect(cls).toMatchObject({
      ok: true,
      value: {
        sessionId,
        sessionName: 'Summer camp',
        name: 'Robotics',
        ageRange: { minAge: 8, maxAge: 12 },
        capacity: 2,
        startsAt: '2027-07-05T09:00:00+10:00',
        endsAt: '2027-07-05T12:00:00+10:00',
        location: 'Lab 1',
      },
    });
  });

  it('adding a class to a missing session is a clear failure', async () => {
    const { service } = setup();
    const r = await service.addClass(
      as('admin'),
      '33333333-3333-4333-8333-333333333333',
      classAt(robotics, monday9to12),
    );
    expect(r).toMatchObject({ ok: false, failure: { reason: 'session_not_found' } });
  });

  it('a class must fall on days inside its session (the camp day counts, not UTC)', async () => {
    const { service } = setup();
    const session = await service.createSession(as('admin'), {
      ...JULY_SESSION,
      startsOn: '2027-07-05',
      endsOn: '2027-07-06',
    });
    if (!session.ok) {
      throw new Error('setup');
    }
    const before = await service.addClass(
      as('admin'),
      session.value.id,
      classAt(robotics, { startsAt: '2027-07-04T09:00:00+10:00', endsAt: '2027-07-04T12:00:00+10:00' }),
    );
    expect(before).toMatchObject({ ok: false, failure: { reason: 'class_outside_session' } });
    const inside = await service.addClass(as('admin'), session.value.id, classAt(robotics, monday9to12));
    expect(inside.ok).toBe(true);
  });

  it('a class shows its instructors by name, and the class write is audited with their ids', async () => {
    const { service, repo } = setup();
    const session = await service.createSession(as('admin'), JULY_SESSION);
    if (!session.ok) {
      throw new Error(session.failure.message);
    }
    const added = await service.addClass(as('admin'), session.value.id, {
      ...classAt(robotics, monday9to12),
      instructorIds: [CAMPER_ADA],
    });
    expect(added).toMatchObject({
      ok: true,
      value: { instructorIds: [CAMPER_ADA], instructors: [{ id: CAMPER_ADA, name: 'Ada Lovelace' }] },
    });
    const classCreates = repo.audit.filter(a => a.action === 'class.create');
    expect(classCreates).toHaveLength(1);
    expect(classCreates[0]).toMatchObject({ actorId: 'user-admin', data: { instructorIds: [CAMPER_ADA] } });
  });

  it('a session lists its classes with their name, location and seat counts', async () => {
    const { service } = setup();
    const { sessionId, classId } = await classWithSession(service);
    await service.enrol(as('staff'), { classId, camperId: CAMPER_ADA, waitlistIfFull: false });
    const listed = await service.listClasses(as('viewer'), sessionId);
    expect(listed).toMatchObject({
      ok: true,
      value: [{ name: 'Robotics', location: 'Lab 1', seatsTaken: 1, waitlisted: 0 }],
    });
    expect(await service.listSessions(as('viewer'))).toMatchObject({ ok: true, value: [{ classCount: 1 }] });
  });

  it('enrolment lists show names, never contact details', async () => {
    const { service } = setup();
    const { classId } = await classWithSession(service);
    await service.enrol(as('staff'), { classId, camperId: CAMPER_ADA, waitlistIfFull: false });
    const listed = await service.listEnrolments(as('viewer'), classId);
    if (!listed.ok) {
      throw new Error('setup');
    }
    expect(listed.value).toHaveLength(1);
    expect(Object.keys(listed.value[0] ?? {}).sort()).toEqual([
      'camperId',
      'camperName',
      'classId',
      'className',
      'enrolledAt',
      'id',
      'overrideReason',
      'status',
    ]);
    expect(listed.value[0]?.camperName).toBe('Ada Lovelace');
  });

  it('an unknown class is a clear failure when listing enrolments', async () => {
    const { service } = setup();
    expect(await service.listEnrolments(as('viewer'), '44444444-4444-4444-8444-444444444444')).toMatchObject({
      ok: false,
      failure: { reason: 'class_not_found' },
    });
  });
});

describe('class service: editing and deleting a class', () => {
  it('edits a class: its name, ages, camp size, time, location and instructors are replaced', async () => {
    const { service, repo } = setup();
    const { classId } = await classWithSession(service);
    const edited = await service.updateClass(as('admin'), classId, {
      ...classAt(painting, { startsAt: '2027-07-06T13:00:00+10:00', endsAt: '2027-07-06T15:00:00+10:00' }),
      instructorIds: [CAMPER_ADA],
    });
    expect(edited).toMatchObject({
      ok: true,
      value: {
        name: 'Painting',
        ageRange: { minAge: 6, maxAge: 14 },
        capacity: 10,
        location: 'Art room',
        startsAt: '2027-07-06T13:00:00+10:00',
        instructors: [{ id: CAMPER_ADA, name: 'Ada Lovelace' }],
      },
    });
    expect(repo.audit.filter(a => a.action === 'class.update')).toHaveLength(1);
  });

  it('an edit keeps the class inside its session dates', async () => {
    const { service } = setup();
    const { classId } = await classWithSession(service);
    const r = await service.updateClass(
      as('admin'),
      classId,
      classAt(robotics, { startsAt: '2027-08-01T09:00:00+10:00', endsAt: '2027-08-01T12:00:00+10:00' }),
    );
    expect(r).toMatchObject({ ok: false, failure: { reason: 'class_outside_session' } });
  });

  it('an edit cannot take the camp size below the places already taken', async () => {
    const { service } = setup();
    const { classId } = await classWithSession(service, { ...robotics, capacity: 3 });
    await service.enrol(as('staff'), { classId, camperId: CAMPER_ADA, waitlistIfFull: false });
    await service.enrol(as('staff'), { classId, camperId: CAMPER_BEN, waitlistIfFull: false });
    const floor = await service.updateClass(as('admin'), classId, classAt({ ...robotics, capacity: 1 }, monday9to12));
    expect(floor).toMatchObject({ ok: false, failure: { reason: 'capacity_below_enrolled' } });
    const fits = await service.updateClass(as('admin'), classId, classAt({ ...robotics, capacity: 2 }, monday9to12));
    expect(fits.ok).toBe(true);
  });

  it('deleting a class with an enrolment is refused, cancelled ones included, and nothing is removed', async () => {
    const { service, repo } = setup();
    const { classId, sessionId } = await classWithSession(service);
    const enrolled = await service.enrol(as('staff'), { classId, camperId: CAMPER_ADA, waitlistIfFull: false });
    if (!enrolled.ok) {
      throw new Error('setup');
    }
    await service.cancelEnrolment(as('staff'), { enrolmentId: enrolled.value.id });
    const refused = await service.deleteClass(as('admin'), classId);
    expect(refused).toMatchObject({ ok: false, failure: { reason: 'class_has_enrolments' } });
    expect(await service.getClass(as('viewer'), classId)).toMatchObject({ ok: true });
    expect(repo.audit.some(a => a.action === 'class.delete')).toBe(false);
    expect(await service.listClasses(as('viewer'), sessionId)).toMatchObject({ ok: true, value: [{ seatsTaken: 0 }] });
  });

  it('deleting a class with no enrolments removes it and audits the delete', async () => {
    const { service, repo } = setup();
    const { classId, sessionId } = await classWithSession(service);
    expect(await service.deleteClass(as('admin'), classId)).toMatchObject({ ok: true, value: null });
    expect(await service.getClass(as('viewer'), classId)).toMatchObject({
      ok: false,
      failure: { reason: 'class_not_found' },
    });
    expect(await service.listClasses(as('viewer'), sessionId)).toEqual({ ok: true, value: [] });
    expect(repo.audit.filter(a => a.action === 'class.delete')).toHaveLength(1);
  });

  it('deleting or editing a class that does not exist is a clear failure', async () => {
    const { service } = setup();
    const missing = '33333333-3333-4333-8333-333333333333';
    expect(await service.deleteClass(as('admin'), missing)).toMatchObject({
      ok: false,
      failure: { reason: 'class_not_found' },
    });
    expect(await service.updateClass(as('admin'), missing, classAt(robotics, monday9to12))).toMatchObject({
      ok: false,
      failure: { reason: 'class_not_found' },
    });
  });
});

describe('class service: audit', () => {
  it('records session, class and enrolment writes, and nothing for reads or refusals', async () => {
    const { service, repo } = setup();
    const { classId } = await classWithSession(service);
    expect(repo.audit.map(a => a.action)).toEqual(['session.create', 'class.create']);
    await service.enrol(as('staff'), { classId, camperId: CAMPER_ADA, waitlistIfFull: false });
    const enrolment = repo.audit.find(a => a.action === 'enrolment.create');
    expect(enrolment).toMatchObject({ orgId: ORG, actorId: 'user-staff', entity: 'enrolment' });
    const refused = await service.enrol(as('staff'), { classId, camperId: CAMPER_ADA, waitlistIfFull: false });
    expect(refused.ok).toBe(false);
    expect(repo.audit.filter(a => a.action === 'enrolment.create')).toHaveLength(1);
  });
});

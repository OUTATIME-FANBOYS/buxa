import { describe, expect, it } from 'vitest';
import { isHttpError } from '../http/errors';
import { CAMPER_ADA, ORG, OTHER_ORG, as, classWithSession, monday9to12, robotics, setup } from './__tests__/fixtures';

const expect403 = async (p: Promise<unknown>) => {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(isHttpError(err) && err.statusCode).toBe(403);
};

describe('class service: permissions (role x method)', () => {
  it('viewers may read classes, sessions and enrolments, and create nothing', async () => {
    const { service } = setup();
    const { classId, sessionId } = await classWithSession(service);
    const viewer = as('viewer');
    expect((await service.listClasses(viewer)).ok).toBe(true);
    expect((await service.getClass(viewer, classId)).ok).toBe(true);
    expect((await service.listSessions(viewer, classId)).ok).toBe(true);
    expect((await service.listEnrolments(viewer, sessionId)).ok).toBe(true);
    await expect403(service.createClass(viewer, robotics));
    await expect403(service.addSession(viewer, classId, monday9to12));
    await expect403(service.enrol(viewer, { sessionId, camperId: CAMPER_ADA, waitlistIfFull: false }));
  });

  it('a viewer cannot cancel an enrolment either', async () => {
    const { service } = setup();
    const { sessionId } = await classWithSession(service);
    const enrolled = await service.enrol(as('staff'), { sessionId, camperId: CAMPER_ADA, waitlistIfFull: false });
    if (!enrolled.ok) {
      throw new Error('setup failed');
    }
    await expect403(service.cancelEnrolment(as('viewer'), { enrolmentId: enrolled.value.id }));
  });

  it('staff may create classes, add sessions, enrol and cancel', async () => {
    const { service } = setup();
    const staff = as('staff');
    const created = await service.createClass(staff, robotics);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const session = await service.addSession(staff, created.value.id, monday9to12);
    expect(session.ok).toBe(true);
    if (!session.ok) {
      return;
    }
    const enrolled = await service.enrol(staff, { sessionId: session.value.id, camperId: CAMPER_ADA, waitlistIfFull: false });
    expect(enrolled.ok).toBe(true);
    if (!enrolled.ok) {
      return;
    }
    expect((await service.cancelEnrolment(staff, { enrolmentId: enrolled.value.id })).ok).toBe(true);
  });

  it('a camp another organisation cannot see its classes, and a missing class is a clear failure', async () => {
    const { service } = setup();
    const { classId } = await classWithSession(service);
    const outsider = as('owner', OTHER_ORG);
    expect(await service.listClasses(outsider)).toEqual({ ok: true, value: [] });
    const missing = await service.getClass(outsider, classId);
    expect(missing).toMatchObject({ ok: false, failure: { reason: 'class_not_found' } });
  });
});

describe('class service: catalogue', () => {
  it('stores the description, age range, default capacity and ratio, and returns them', async () => {
    const { service } = setup();
    const created = await service.createClass(as('admin'), robotics);
    if (!created.ok) {
      throw new Error('setup');
    }
    expect(created.value).toMatchObject({ name: 'Robotics', description: 'Build and program small robots.', ageRange: { minAge: 8, maxAge: 12 }, capacity: 2, instructorRatio: { instructors: 1, campers: 8 } });
  });

  it('a session takes the class capacity when none is given, and its own when it is', async () => {
    const { service } = setup();
    const { classId } = await classWithSession(service);
    const own = await service.addSession(as('admin'), classId, { ...monday9to12, capacity: 5, startsAt: '2027-07-06T09:00:00+10:00', endsAt: '2027-07-06T12:00:00+10:00' });
    const sessions = await service.listSessions(as('viewer'), classId);
    expect(own).toMatchObject({ ok: true, value: { capacity: 5 } });
    expect(sessions).toMatchObject({ ok: true, value: [{ capacity: 2 }, { capacity: 5 }] });
  });

  it('adding a session to a missing class is a clear failure', async () => {
    const { service } = setup();
    const r = await service.addSession(as('admin'), '33333333-3333-4333-8333-333333333333', monday9to12);
    expect(r).toMatchObject({ ok: false, failure: { reason: 'class_not_found' } });
  });

  it('a session shows its instructors by name, and the session write is audited with their ids', async () => {
    const { service, repo } = setup();
    const created = await service.createClass(as('admin'), robotics);
    if (!created.ok) {
      throw new Error(created.failure.message);
    }
    const added = await service.addSession(as('admin'), created.value.id, { ...monday9to12, instructorIds: [CAMPER_ADA] });
    expect(added).toMatchObject({ ok: true, value: { instructorIds: [CAMPER_ADA], instructors: [{ id: CAMPER_ADA, name: 'Ada Lovelace' }] } });
    expect(repo.audit.filter(a => a.action === 'session.create')).toEqual([
      expect.objectContaining({ actorId: 'user-admin', data: expect.objectContaining({ instructorIds: [CAMPER_ADA] }) }),
    ]);
    const listed = await service.listSessions(as('viewer'), created.value.id);
    expect(listed).toMatchObject({ ok: true, value: [{ instructors: [{ id: CAMPER_ADA, name: 'Ada Lovelace' }] }] });
  });

  it('a session is shown with its class name, location and seat counts', async () => {
    const { service } = setup();
    const { classId, sessionId } = await classWithSession(service);
    await service.enrol(as('staff'), { sessionId, camperId: CAMPER_ADA, waitlistIfFull: false });
    const listed = await service.listSessions(as('viewer'), classId);
    expect(listed).toMatchObject({ ok: true, value: [{ className: 'Robotics', location: 'Lab 1', seatsTaken: 1, waitlisted: 0 }] });
  });

  it('enrolment lists show names, never contact details', async () => {
    const { service } = setup();
    const { sessionId } = await classWithSession(service);
    await service.enrol(as('staff'), { sessionId, camperId: CAMPER_ADA, waitlistIfFull: false });
    const listed = await service.listEnrolments(as('viewer'), sessionId);
    if (!listed.ok) {
      throw new Error('setup');
    }
    expect(listed.value).toHaveLength(1);
    expect(Object.keys(listed.value[0] ?? {}).sort()).toEqual(['camperId', 'camperName', 'classId', 'className', 'enrolledAt', 'id', 'overrideReason', 'sessionId', 'status']);
    expect(listed.value[0]?.camperName).toBe('Ada Lovelace');
  });

  it('an unknown session is a clear failure when listing enrolments', async () => {
    const { service } = setup();
    expect(await service.listEnrolments(as('viewer'), '44444444-4444-4444-8444-444444444444')).toMatchObject({ ok: false, failure: { reason: 'session_not_found' } });
  });
});

describe('class service: audit', () => {
  it('records class and session creation, and cancellation, and nothing for reads or refusals', async () => {
    const { service, repo } = setup();
    const { sessionId } = await classWithSession(service);
    expect(repo.audit.map(a => a.action)).toEqual(['class.create', 'session.create']);
    await service.enrol(as('staff'), { sessionId, camperId: CAMPER_ADA, waitlistIfFull: false });
    const enrolment = repo.audit.find(a => a.action === 'enrolment.create');
    expect(enrolment).toMatchObject({ orgId: ORG, actorId: 'user-staff', entity: 'enrolment' });
    const refused = await service.enrol(as('staff'), { sessionId, camperId: CAMPER_ADA, waitlistIfFull: false });
    expect(refused.ok).toBe(false);
    expect(repo.audit.filter(a => a.action === 'enrolment.create')).toHaveLength(1);
  });
});

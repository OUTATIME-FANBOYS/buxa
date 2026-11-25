import { describe, expect, it } from 'vitest';
import { isHttpError } from '../http/errors';
import { CAMPER_ADA, JULY_SESSION, as, classWithSession, setup } from './__tests__/fixtures';

const EDIT = {
  name: 'Winter camp',
  description: 'Three weeks in July.',
  startsOn: '2027-07-02',
  endsOn: '2027-07-30',
  isPublic: true,
};

const expect403 = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isHttpError(err) && err.statusCode).toBe(403);
};

async function sessionSetup() {
  const ctx = setup();
  const created = await ctx.service.createSession(as('admin'), JULY_SESSION);
  if (!created.ok) {
    throw new Error('setup failed');
  }

  return { ...ctx, sessionId: created.value.id };
}

describe('edit session', () => {
  it('saves the name, description, dates and public flag, and returns the session', async () => {
    const { service, sessionId } = await sessionSetup();
    const outcome = await service.updateSession(as('staff'), sessionId, EDIT);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value).toMatchObject({ ...EDIT, id: sessionId });
    }
  });

  it('a session carries no price: its read has no price field, and an edit writes none', async () => {
    const { service, sessionId } = await sessionSetup();
    await service.updateSession(as('admin'), sessionId, EDIT);
    const session = await service.getSession(as('admin'), sessionId);
    expect(session.ok && 'price' in session.value).toBe(false);
  });

  it('refuses a last day before the first day, and changes nothing', async () => {
    const { service, sessionId, repo } = await sessionSetup();
    const outcome = await service.updateSession(as('admin'), sessionId, {
      ...EDIT,
      startsOn: '2027-07-10',
      endsOn: '2027-07-09',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.reason).toBe('session_invalid');
      expect(outcome.failure.message).toBe('The session must end on or after its first day.');
    }
    expect(repo.audit.some(a => a.action === 'session.update')).toBe(false);
  });

  it('a new date range that leaves a class outside it saves, and flags that class with its times kept', async () => {
    const { service, sessionId } = await sessionSetup();
    const added = await service.addClass(as('admin'), sessionId, {
      name: 'Robotics',
      ageRange: { minAge: 8, maxAge: 12 },
      capacity: 12,
      location: 'Lab 1',
      instructorIds: [],
      price: null,
      startsAt: '2027-07-05T09:00:00+10:00',
      endsAt: '2027-07-05T12:00:00+10:00',
    });
    const outcome = await service.updateSession(as('admin'), sessionId, { ...EDIT, startsOn: '2027-07-06' });
    expect(outcome.ok).toBe(true);
    const classes = await service.listClasses(as('admin'), sessionId);
    const flagged = classes.ok ? classes.value.find(c => c.id === (added.ok ? added.value.id : '')) : undefined;
    expect(flagged).toMatchObject({ datesOutsideSession: true, startsAt: '2027-07-05T09:00:00+10:00' });
  });

  it('refuses a viewer, a teacher and anyone without classes:manage', async () => {
    const { service, sessionId } = await sessionSetup();
    await expect403(service.updateSession(as('viewer'), sessionId, EDIT));
    await expect403(service.updateSession(as('teacher'), sessionId, EDIT));
  });

  it('refuses an archived camp, even for an owner', async () => {
    const { service, sessionId, repo } = await sessionSetup();
    await expect403(service.updateSession({ ...as('owner'), archived: true }, sessionId, EDIT));
    expect(repo.audit.some(a => a.action === 'session.update')).toBe(false);
  });

  it('writes a session.update audit entry with the old and the new values', async () => {
    const { service, sessionId, repo } = await sessionSetup();
    await service.updateSession(as('staff'), sessionId, EDIT);
    const updates = repo.audit.filter(a => a.action === 'session.update');
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      actorId: 'user-staff',
      entity: 'session',
      entityId: sessionId,
      data: {
        previousName: 'Summer camp',
        name: 'Winter camp',
        previousStartsOn: '2027-07-01',
        startsOn: '2027-07-02',
        previousEndsOn: '2027-07-31',
        endsOn: '2027-07-30',
        previousIsPublic: false,
        isPublic: true,
      },
    });
  });

  it('writes no audit entry when nothing changed', async () => {
    const { service, sessionId, repo } = await sessionSetup();
    await service.updateSession(as('admin'), sessionId, { ...JULY_SESSION, isPublic: false });
    expect(repo.audit.some(a => a.action === 'session.update')).toBe(false);
  });
});

describe('delete session', () => {
  it('deletes an empty session and writes a session.delete audit entry', async () => {
    const { service, sessionId, repo } = await sessionSetup();
    const outcome = await service.deleteSession(as('admin'), sessionId);
    expect(outcome.ok).toBe(true);
    const found = await service.getSession(as('admin'), sessionId);
    expect(found.ok).toBe(false);
    const deletes = repo.audit.filter(a => a.action === 'session.delete');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toMatchObject({ entity: 'session', entityId: sessionId, data: { name: 'Summer camp' } });
  });

  it('refuses a session that has a class, and deletes nothing', async () => {
    const { service } = setup();
    const { sessionId } = await classWithSession(service);
    const outcome = await service.deleteSession(as('admin'), sessionId);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.reason).toBe('session_has_classes');
      expect(outcome.failure.message).toBe(
        'This session has classes, so it cannot be deleted. Archive it, or delete its classes and the session.',
      );
    }
    expect((await service.getSession(as('admin'), sessionId)).ok).toBe(true);
  });

  it('refuses a session whose class has enrolments, and keeps the enrolments', async () => {
    const { service } = setup();
    const { sessionId, classId } = await classWithSession(service);
    const enrolled = await service.enrol(as('staff'), { classId, camperId: CAMPER_ADA, waitlistIfFull: false });
    expect(enrolled.ok).toBe(true);
    const outcome = await service.deleteSession(as('admin'), sessionId);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.message).toBe(
        'This session has classes, so it cannot be deleted. Archive it, or delete its classes and the session.',
      );
    }
    const kept = await service.listEnrolments(as('admin'), classId);
    expect(kept.ok && kept.value).toHaveLength(1);
  });

  it('refuses a viewer and a teacher', async () => {
    const { service, sessionId } = await sessionSetup();
    await expect403(service.deleteSession(as('viewer'), sessionId));
    await expect403(service.deleteSession(as('teacher'), sessionId));
  });
});

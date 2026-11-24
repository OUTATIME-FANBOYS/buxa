import { describe, expect, it } from 'vitest';
import { isHttpError } from '../http/errors';
import { CAMPER_ADA, JULY_SESSION, as, classWithSession, setup } from './__tests__/fixtures';

// Sessions (rows of `classes`) can be archived, and a session with classes can be deleted with them by an admin or the owner.
// Session names are unique in a camp, ignoring case and spaces. The database rules are tested in packages/db/test.

const sessionNameOf = async (service: ReturnType<typeof setup>['service'], id: string): Promise<string> => {
  const found = await service.getSession(as('admin'), id);

  return found.ok ? found.value.name : '';
};

const expect403 = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isHttpError(err) && err.statusCode).toBe(403);
};

describe('delete a session with its classes', () => {
  it('lets an admin delete the classes and the session, and writes an audit entry for each class and for the session', async () => {
    const { service, repo } = setup();
    const { sessionId, classId } = await classWithSession(service);
    const name = await sessionNameOf(service, sessionId);

    const outcome = await service.deleteSessionWithClasses(as('admin'), sessionId, name);

    expect(outcome.ok).toBe(true);
    expect((await service.getSession(as('admin'), sessionId)).ok).toBe(false);
    expect((await service.getClass(as('admin'), classId)).ok).toBe(false);
    const classDeletes = repo.audit.filter(a => a.action === 'class.delete');
    expect(classDeletes).toHaveLength(1);
    expect(classDeletes[0]).toMatchObject({ entity: 'class', entityId: classId, actorId: 'user-admin' });
    const sessionDeletes = repo.audit.filter(a => a.action === 'session.delete');
    expect(sessionDeletes).toHaveLength(1);
    expect(sessionDeletes[0]).toMatchObject({ entity: 'session', entityId: sessionId, data: { name } });
  });

  it('lets the owner delete too', async () => {
    const { service, repo } = setup();
    const { sessionId } = await classWithSession(service);
    const name = await sessionNameOf(service, sessionId);
    const outcome = await service.deleteSessionWithClasses(as('owner'), sessionId, name);
    expect(outcome.ok).toBe(true);
    expect(repo.audit.some(a => a.action === 'session.delete' && a.actorId === 'user-owner')).toBe(true);
  });

  it('refuses a staff member, a teacher and a viewer, and deletes nothing', async () => {
    const { service } = setup();
    const { sessionId } = await classWithSession(service);
    const name = await sessionNameOf(service, sessionId);
    await expect403(service.deleteSessionWithClasses(as('staff'), sessionId, name));
    await expect403(service.deleteSessionWithClasses(as('teacher'), sessionId, name));
    await expect403(service.deleteSessionWithClasses(as('viewer'), sessionId, name));
    expect((await service.getSession(as('admin'), sessionId)).ok).toBe(true);
  });

  it('refuses a typed name that differs in case or spacing, and deletes nothing', async () => {
    const { service } = setup();
    const { sessionId } = await classWithSession(service);
    const name = await sessionNameOf(service, sessionId);

    const wrongCase = await service.deleteSessionWithClasses(as('admin'), sessionId, name.toLowerCase());
    expect(wrongCase.ok).toBe(false);
    if (!wrongCase.ok) {
      expect(wrongCase.failure.reason).toBe('session_name_confirmation');
    }
    const spaced = await service.deleteSessionWithClasses(as('admin'), sessionId, `${name} `);
    expect(spaced.ok).toBe(false);
    expect((await service.getSession(as('admin'), sessionId)).ok).toBe(true);
  });

  it('refuses a session whose class has an enrolment, says to archive it, and keeps the enrolment', async () => {
    const { service, repo } = setup();
    const { sessionId, classId } = await classWithSession(service);
    const name = await sessionNameOf(service, sessionId);
    await service.enrol(as('staff'), { classId, camperId: CAMPER_ADA, waitlistIfFull: false });

    const outcome = await service.deleteSessionWithClasses(as('admin'), sessionId, name);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.reason).toBe('session_has_enrolments');
      expect(outcome.failure.message).toBe('This session has enrolments, archive it instead');
    }
    expect((await service.getSession(as('admin'), sessionId)).ok).toBe(true);
    const kept = await service.listEnrolments(as('admin'), classId);
    expect(kept.ok && kept.value).toHaveLength(1);
    expect(repo.audit.some(a => a.action === 'session.delete' || a.action === 'class.delete')).toBe(false);
  });

  it('a plain delete still refuses a session with classes, and points to the two choices', async () => {
    const { service } = setup();
    const { sessionId } = await classWithSession(service);
    const outcome = await service.deleteSession(as('admin'), sessionId);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.reason).toBe('session_has_classes');
    }
  });
});

describe('archive a session', () => {
  it('archives a session (kept, with its classes) and writes session.archive', async () => {
    const { service, repo } = setup();
    const { sessionId, classId } = await classWithSession(service);

    const outcome = await service.setSessionArchived(as('staff'), sessionId, true);

    expect(outcome.ok && outcome.value.archivedAt).not.toBeNull();
    const kept = await service.getClass(as('admin'), classId);
    expect(kept.ok).toBe(true);
    expect(repo.audit.filter(a => a.action === 'session.archive')).toHaveLength(1);
  });

  it('shows the archive time on the session list', async () => {
    const { service } = setup();
    const { sessionId } = await classWithSession(service);
    await service.setSessionArchived(as('admin'), sessionId, true);
    const listed = await service.listSessions(as('admin'));
    expect(listed.ok && listed.value.find(s => s.id === sessionId)?.archivedAt).toEqual(expect.any(String));
  });

  it('unarchives a session for an admin, and clears the archive time', async () => {
    const { service, repo } = setup();
    const { sessionId } = await classWithSession(service);
    await service.setSessionArchived(as('staff'), sessionId, true);

    const outcome = await service.setSessionArchived(as('admin'), sessionId, false);

    expect(outcome.ok && outcome.value.archivedAt).toBeNull();
    expect(repo.audit.filter(a => a.action === 'session.unarchive')).toHaveLength(1);
  });

  it('refuses staff to unarchive, though staff may archive', async () => {
    const { service } = setup();
    const { sessionId } = await classWithSession(service);
    await service.setSessionArchived(as('staff'), sessionId, true);
    await expect403(service.setSessionArchived(as('staff'), sessionId, false));
    const still = await service.getSession(as('admin'), sessionId);
    expect(still.ok && still.value.archivedAt).not.toBeNull();
  });

  it('refuses a viewer and a teacher', async () => {
    const { service } = setup();
    const { sessionId } = await classWithSession(service);
    await expect403(service.setSessionArchived(as('viewer'), sessionId, true));
    await expect403(service.setSessionArchived(as('teacher'), sessionId, true));
  });

  it('a session with no classes is still deleted normally after it is archived', async () => {
    const { service } = setup();
    const created = await service.createSession(as('admin'), JULY_SESSION);
    if (!created.ok) {
      throw new Error(created.failure.message);
    }
    await service.setSessionArchived(as('admin'), created.value.id, true);
    expect((await service.deleteSession(as('admin'), created.value.id)).ok).toBe(true);
  });
});

describe('session names are unique in the camp', () => {
  it('refuses a second session whose name differs only in case and spaces, and names the first', async () => {
    const { service, repo } = setup();
    await service.createSession(as('admin'), { ...JULY_SESSION, name: 'Summer 2027' });

    const outcome = await service.createSession(as('admin'), { ...JULY_SESSION, name: '  summer   2027 ' });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.reason).toBe('session_name_taken');
      expect(outcome.failure.message).toBe('A session named Summer 2027 already exists.');
    }
    expect(repo.audit.filter(a => a.action === 'session.create')).toHaveLength(1);
  });

  it('refuses a rename onto another session name, and changes nothing', async () => {
    const { service } = setup();
    await service.createSession(as('admin'), { ...JULY_SESSION, name: 'Summer 2027' });
    const second = await service.createSession(as('admin'), { ...JULY_SESSION, name: 'Art' });
    if (!second.ok) {
      throw new Error(second.failure.message);
    }

    const outcome = await service.updateSession(as('admin'), second.value.id, {
      ...JULY_SESSION,
      name: 'SUMMER 2027',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.reason).toBe('session_name_taken');
      expect(outcome.failure.message).toBe('A session named Summer 2027 already exists.');
    }
    const still = await service.getSession(as('admin'), second.value.id);
    expect(still.ok && still.value.name).toBe('Art');
  });

  it('lets a session keep its own name with a change of case', async () => {
    const { service } = setup();
    const created = await service.createSession(as('admin'), { ...JULY_SESSION, name: 'Summer 2027' });
    if (!created.ok) {
      throw new Error(created.failure.message);
    }
    const outcome = await service.updateSession(as('admin'), created.value.id, {
      ...JULY_SESSION,
      name: 'summer 2027',
    });
    expect(outcome.ok).toBe(true);
  });
});

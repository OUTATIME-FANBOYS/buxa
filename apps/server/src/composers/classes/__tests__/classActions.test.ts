import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionPath } from '@buxa/shared/config/routes';
import { idle } from '@buxa/shared';
import { addClassAction } from '../addClassAction';
import { createSessionAction } from '../createSessionAction';
import { deleteClassAction } from '../deleteClassAction';
import { updateClassAction } from '../updateClassAction';
import { formOf, IDS } from './form';
import { settle } from '@buxa/domain';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  classes: {
    createSession: vi.fn(),
    addClass: vi.fn(),
    updateClass: vi.fn(),
    deleteClass: vi.fn(),
  },
  orgs: { getCamp: vi.fn() },
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: { classes: h.classes, orgs: h.orgs } }) }));
vi.mock('../../people/camp', () => ({ currentActor: () => settle(() => h.actor) }));

const SYDNEY = 'Australia/Sydney';
const session = {
  name: 'Summer camp',
  description: 'Two weeks',
  startsOn: '2027-07-01',
  endsOn: '2027-07-14',
};
const cls = {
  sessionId: IDS.session,
  name: 'Robotics',
  minAge: '8',
  maxAge: '12',
  capacity: '12',
  startsAt: '2027-07-05T09:00',
  endsAt: '2027-07-05T12:00',
  location: 'Lab 1',
};
const classOk = { ok: true, value: { id: IDS.cls, sessionId: IDS.session } };

beforeEach(() => {
  vi.clearAllMocks();
  h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
  h.orgs.getCamp.mockResolvedValue({ timezone: SYDNEY });
  h.redirect.mockImplementation((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  });
});

describe('createSessionAction (the date range)', () => {
  beforeEach(() => {
    h.classes.createSession.mockResolvedValue({ ok: true, value: { id: IDS.session } });
  });

  it('creates the session from its dates and opens its page', async () => {
    await expect(createSessionAction(idle, formOf(session))).rejects.toThrow(
      `NEXT_REDIRECT ${sessionPath(IDS.session)}`,
    );
    expect(h.classes.createSession).toHaveBeenCalledWith(h.actor, {
      name: 'Summer camp',
      description: 'Two weeks',
      startsOn: '2027-07-01',
      endsOn: '2027-07-14',
    });
  });

  it('answers a missing day with a field error, and creates nothing', async () => {
    const state = await createSessionAction(idle, formOf({ ...session, endsOn: '' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { endsOn: 'Choose the last day.' } });
    expect(h.classes.createSession).not.toHaveBeenCalled();
  });

  it("shows the service's forbidden message to a viewer, and writes nothing more", async () => {
    h.classes.createSession.mockResolvedValue({
      ok: false,
      failure: { reason: 'class_not_found', message: 'Only staff with class permission can do this.' },
    });
    expect(await createSessionAction(idle, formOf(session))).toEqual({
      status: 'error',
      message: 'Only staff with class permission can do this.',
    });
  });
});

describe('addClassAction (the time range and the camp size)', () => {
  beforeEach(() => {
    h.classes.addClass.mockResolvedValue(classOk);
  });

  it('reads the class times in the camp zone and adds the class to the session', async () => {
    const state = await addClassAction(idle, formOf(cls));
    expect(state).toEqual({ status: 'success', message: 'Class added.' });
    expect(h.classes.addClass).toHaveBeenCalledWith(
      h.actor,
      IDS.session,
      expect.objectContaining({
        name: 'Robotics',
        ageRange: { minAge: 8, maxAge: 12 },
        capacity: 12,
        startsAt: '2027-07-04T23:00:00.000Z',
        endsAt: '2027-07-05T02:00:00.000Z',
        location: 'Lab 1',
      }),
    );
  });

  it.each([
    ['2', '12'],
    ['8', '21'],
  ])(
    'refuses ages %s to %s on the server (outside 3 to 20), with the message, and adds nothing',
    async (minAge, maxAge) => {
      const state = await addClassAction(idle, formOf({ ...cls, minAge, maxAge }));
      expect(JSON.stringify(state)).toContain('Ages are whole numbers from 3 to 20.');
      expect(h.classes.addClass).not.toHaveBeenCalled();
    },
  );

  it.each(['2', '31'])(
    'refuses a camp size of %s on the server, with the message, and adds nothing',
    async capacity => {
      const state = await addClassAction(idle, formOf({ ...cls, capacity }));
      expect(state).toMatchObject({
        status: 'error',
        fieldErrors: { capacity: 'Camp Size must be a whole number from 3 to 30.' },
      });
      expect(h.classes.addClass).not.toHaveBeenCalled();
    },
  );

  it('answers a bad time with a field error, and adds nothing', async () => {
    const state = await addClassAction(idle, formOf({ ...cls, startsAt: 'tomorrow morning' }));
    expect(state).toMatchObject({
      status: 'error',
      fieldErrors: { startsAt: 'Use the format 2027-07-05T09:00 (camp time).' },
    });
    expect(h.classes.addClass).not.toHaveBeenCalled();
  });

  it('refuses a session id that is not a UUID before anything else', async () => {
    expect(await addClassAction(idle, formOf({ ...cls, sessionId: 'nope' }))).toMatchObject({ status: 'error' });
    expect(h.classes.addClass).not.toHaveBeenCalled();
  });

  it("shows the service's message when the class falls outside the session's dates", async () => {
    h.classes.addClass.mockResolvedValue({
      ok: false,
      failure: {
        reason: 'class_outside_session',
        message: 'The class must fall on days between 2027-07-01 and 2027-07-14.',
      },
    });
    expect(await addClassAction(idle, formOf(cls))).toEqual({
      status: 'error',
      message: 'The class must fall on days between 2027-07-01 and 2027-07-14.',
    });
  });
});

describe('updateClassAction', () => {
  it('saves the class and refreshes its session page', async () => {
    h.classes.updateClass.mockResolvedValue(classOk);
    expect(await updateClassAction(idle, formOf({ ...cls, classId: IDS.cls, capacity: '3' }))).toEqual({
      status: 'success',
      message: 'Class saved.',
    });
    expect(h.classes.updateClass).toHaveBeenCalledWith(h.actor, IDS.cls, expect.objectContaining({ capacity: 3 }));
    expect(h.revalidatePath).toHaveBeenCalledWith(sessionPath(IDS.session));
  });

  it('refuses a camp size above 30 on the server, and changes nothing', async () => {
    const state = await updateClassAction(idle, formOf({ ...cls, classId: IDS.cls, capacity: '31' }));
    expect(state).toMatchObject({
      status: 'error',
      fieldErrors: { capacity: 'Camp Size must be a whole number from 3 to 30.' },
    });
    expect(h.classes.updateClass).not.toHaveBeenCalled();
  });

  it("shows the service's message when the camp size is below the places taken", async () => {
    h.classes.updateClass.mockResolvedValue({
      ok: false,
      failure: {
        reason: 'capacity_below_enrolled',
        message: 'The camp size cannot go below the places already taken.',
      },
    });
    expect(await updateClassAction(idle, formOf({ ...cls, classId: IDS.cls }))).toEqual({
      status: 'error',
      message: 'The camp size cannot go below the places already taken.',
    });
  });

  it('refuses a class id that is not a UUID', async () => {
    expect(await updateClassAction(idle, formOf({ ...cls, classId: 'nope' }))).toMatchObject({ status: 'error' });
    expect(h.classes.updateClass).not.toHaveBeenCalled();
  });
});

describe('deleteClassAction', () => {
  it('deletes the class and refreshes its session page', async () => {
    h.classes.deleteClass.mockResolvedValue({ ok: true, value: null });
    expect(await deleteClassAction(idle, formOf({ classId: IDS.cls, sessionId: IDS.session }))).toEqual({
      status: 'success',
      message: 'Class deleted.',
    });
    expect(h.classes.deleteClass).toHaveBeenCalledWith(h.actor, IDS.cls);
    expect(h.revalidatePath).toHaveBeenCalledWith(sessionPath(IDS.session));
  });

  it('refuses, with the reason, a class that has enrolments', async () => {
    h.classes.deleteClass.mockResolvedValue({
      ok: false,
      failure: {
        reason: 'class_has_enrolments',
        message: 'This class has enrolments, so it cannot be deleted. Cancel them first.',
      },
    });
    expect(await deleteClassAction(idle, formOf({ classId: IDS.cls, sessionId: IDS.session }))).toEqual({
      status: 'error',
      message: 'This class has enrolments, so it cannot be deleted. Cancel them first.',
    });
  });

  it('refuses a missing id before calling the service', async () => {
    expect(await deleteClassAction(idle, formOf({ classId: '', sessionId: IDS.session }))).toMatchObject({
      status: 'error',
    });
    expect(h.classes.deleteClass).not.toHaveBeenCalled();
  });
});

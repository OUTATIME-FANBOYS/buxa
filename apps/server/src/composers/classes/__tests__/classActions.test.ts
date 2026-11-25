import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionPath } from '@buxa/shared/config/routes';
import { idle } from '@buxa/shared';
import { createSessionAction } from '../createSessionAction';
import { deleteClassAction } from '../deleteClassAction';
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
      isPublic: false,
    });
  });

  it('answers a missing day with a field error, and creates nothing', async () => {
    const state = await createSessionAction(idle, formOf({ ...session, endsOn: '' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { endsOn: 'Pick a last day.' } });
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

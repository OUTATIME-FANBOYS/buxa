import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classPath } from '@/config/routes';
import { idle } from '@/lib/actions/state';
import { addSessionAction } from '../addSessionAction';
import { formOf, IDS } from './form';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  classes: { addSession: vi.fn() },
  orgs: { getCamp: vi.fn() },
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services: { classes: h.classes, orgs: h.orgs } }) }));
vi.mock('@/features/people/lib/camp', () => ({ currentActor: async () => h.actor }));

const session = { classId: IDS.cls, startsAt: '2027-07-05T09:00', endsAt: '2027-07-05T12:00', location: 'Lab 1', capacity: '', instructorIds: [] as string[] };

describe('addSessionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
    h.orgs.getCamp.mockResolvedValue({ timezone: 'Australia/Sydney' });
    h.redirect.mockImplementation((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); });
    h.classes.addSession.mockResolvedValue({ ok: true, value: { id: IDS.session } });
  });

  it('reads the times in the camp zone, sends instants with an offset, and opens the class', async () => {
    await expect(addSessionAction(idle, formOf(session))).rejects.toThrow(`NEXT_REDIRECT ${classPath(IDS.cls)}`);
    expect(h.classes.addSession).toHaveBeenCalledWith(h.actor, IDS.cls, expect.objectContaining({
      startsAt: '2027-07-04T23:00:00.000Z', endsAt: '2027-07-05T02:00:00.000Z', location: 'Lab 1',
    }));
  });

  it('answers a bad time with a field error, and adds nothing', async () => {
    const state = await addSessionAction(idle, formOf({ ...session, startsAt: 'tomorrow morning' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { startsAt: 'Use the format 2027-07-05T09:00 (camp time).' } });
    expect(h.classes.addSession).not.toHaveBeenCalled();
  });

  it('refuses a class id that is not a UUID before anything else', async () => {
    expect(await addSessionAction(idle, formOf({ ...session, classId: 'nope' }))).toMatchObject({ status: 'error' });
    expect(h.classes.addSession).not.toHaveBeenCalled();
  });

  it('shows the service\'s message when the class is not in the camp', async () => {
    h.classes.addSession.mockResolvedValue({ ok: false, failure: { reason: 'class_not_found', message: 'That class no longer exists.' } });
    expect(await addSessionAction(idle, formOf(session))).toEqual({ status: 'error', message: 'That class no longer exists.' });
  });
});

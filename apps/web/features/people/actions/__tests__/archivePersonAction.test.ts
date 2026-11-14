import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/config/routes';
import { conflict, forbidden } from '@/server/http/errors';
import { archivePersonAction } from '../archivePersonAction';
import { IDS } from './form';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  people: { archive: vi.fn() },
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services: { people: h.people } }) }));
vi.mock('@/features/people/lib/camp', () => ({ currentActor: async () => h.actor }));

describe('archivePersonAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'admin' };
    h.redirect.mockImplementation((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); });
    h.people.archive.mockResolvedValue(undefined);
  });

  it('archives, refreshes the list and leaves for it', async () => {
    await expect(archivePersonAction(IDS.person)).rejects.toThrow(`NEXT_REDIRECT ${ROUTES.people}`);
    expect(h.people.archive).toHaveBeenCalledWith(h.actor, IDS.person);
    expect(h.revalidatePath).toHaveBeenCalledWith(ROUTES.people);
  });

  it('shows why a checked-in person cannot be archived (409) and stays on the page', async () => {
    h.people.archive.mockRejectedValueOnce(conflict('They are checked in. Check them out first.'));
    expect(await archivePersonAction(IDS.person)).toEqual({ status: 'error', message: 'They are checked in. Check them out first.', fieldErrors: undefined });
    expect(h.redirect).not.toHaveBeenCalled();
  });

  it('turns a 403 (a role without people:delete) into a friendly state', async () => {
    h.people.archive.mockRejectedValueOnce(forbidden('no'));
    expect(await archivePersonAction(IDS.person)).toMatchObject({ status: 'error', message: 'Your role cannot do this.' });
  });

  it('rejects an id that is not a UUID', async () => {
    expect(await archivePersonAction('../etc')).toMatchObject({ status: 'error' });
    expect(h.people.archive).not.toHaveBeenCalled();
  });
});

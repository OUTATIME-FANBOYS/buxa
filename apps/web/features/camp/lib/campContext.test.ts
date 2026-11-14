import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Membership } from '@buxa/contracts';

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
const session = vi.hoisted(() => ({ camp: null as Membership | null }));

vi.mock('next/navigation', () => ({ notFound }));
vi.mock('@/server/session', () => ({
  requireSession: async () => ({ user: { id: 'u1' } }),
  getCurrentCamp: async () => session.camp,
  toActor: (_s: unknown, camp: Membership) => ({ userId: 'u1', orgId: camp.orgId, role: camp.role }),
}));

const { campContext, findCampContext } = await import('./campContext');

const camp: Membership = { orgId: 'o1', role: 'staff', name: 'Sunrise', slug: 'sunrise' };

beforeEach(() => { vi.clearAllMocks(); session.camp = camp; });

describe('findCampContext', () => {
  it('returns the session, the camp and the actor for the camp being worked in', async () => {
    const context = await findCampContext();
    expect(context?.camp).toBe(camp);
    expect(context?.actor).toEqual({ userId: 'u1', orgId: 'o1', role: 'staff' });
  });

  it('returns null, without calling notFound, when no camp is selected', async () => {
    session.camp = null;
    await expect(findCampContext()).resolves.toBeNull();
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe('campContext', () => {
  it('returns the same context as findCampContext when there is a camp', async () => {
    await expect(campContext()).resolves.toEqual(await findCampContext());
  });

  it('answers not-found when there is no camp', async () => {
    session.camp = null;
    await expect(campContext()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

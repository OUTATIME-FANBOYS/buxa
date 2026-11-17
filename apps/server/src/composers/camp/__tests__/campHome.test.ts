import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Membership, PersonSummary } from '@buxa/contracts';
import type { Role } from '@buxa/domain';

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string; name: string }; memberships: Membership[] }, camp: null as Membership | null }));
const services = vi.hoisted(() => ({
  orgs: { getCamp: vi.fn(async () => ({ id: 'o1', name: 'Lake Camp', slug: 'lake', createdAt: '2026-03-04T10:00:00Z', memberCount: 3 })) },
  people: { list: vi.fn(async (): Promise<PersonSummary[]> => []) },
  attendance: { onSite: vi.fn(async (): Promise<string[]> => []) },
}));

vi.mock('next/navigation', () => ({ notFound }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('../../../session', () => ({
  requireSession: async () => session.current,
  getCurrentCamp: async () => session.camp,
  toActor: (s: { user: { id: string } }, camp: Membership) => ({ userId: s.user.id, orgId: camp.orgId, role: camp.role }),
}));

const { loadCampHome } = await import('../campHome');

const person = (id: string, status: PersonSummary['status']): PersonSummary => ({
  id, givenName: id, familyName: 'Test', preferredName: null, roles: ['camper'], status, onSite: false, archived: false,
});

const as = (role: Role) => {
  const camp: Membership = { orgId: 'o1', role, name: 'Lake Camp', slug: 'lake' };
  session.current = { user: { id: 'u1', email: 'priya@example.com', name: 'Priya Nair' }, memberships: [camp] };
  session.camp = camp;
};

beforeEach(() => {
  vi.clearAllMocks();
  services.people.list.mockResolvedValue([person('a', 'valid'), person('b', 'valid'), person('c', 'expired')]);
  services.attendance.onSite.mockResolvedValue(['a']);
});

describe('loadCampHome', () => {
  it('reads the camp facts through the services as the actor', async () => {
    as('staff');
    const home = await loadCampHome();
    expect(services.orgs.getCamp).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', role: 'staff' });
    expect(home).toEqual({ campId: 'o1', name: 'Lake Camp', firstName: 'Priya', canRename: false, people: 3, onSite: 1, validMemberships: 2 });
  });

  it.each([['owner', true], ['admin', true], ['staff', false], ['viewer', false]] as const)('%s may rename the camp: %s', async (role, canRename) => {
    as(role);
    expect((await loadCampHome()).canRename).toBe(canRename);
  });

  it('answers not-found when there is no camp', async () => {
    as('owner');
    session.camp = null;
    await expect(loadCampHome()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

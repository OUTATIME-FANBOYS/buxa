import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Membership, PersonSummary, Session } from '@buxa/contracts';
import type { Role } from '@buxa/domain';

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string; name: string }; memberships: Membership[] }, camp: null as Membership | null }));
const services = vi.hoisted(() => ({
  orgs: { getCamp: vi.fn(async () => ({ id: 'o1', name: 'Lake Camp', slug: 'lake', createdAt: '2026-03-04T10:00:00Z', memberCount: 3, timezone: 'UTC' })) },
  people: { list: vi.fn(async (): Promise<PersonSummary[]> => []) },
  attendance: {
    onSite: vi.fn(async (): Promise<{ personId: string }[]> => []),
    log: vi.fn<(actor: unknown, filter: { from: string; to: string }) => Promise<{ personId: string }[]>>(async () => []),
  },
  classes: {
    listClasses: vi.fn(async () => ({ ok: true as const, value: [] as { id: string }[] })),
    listSessions: vi.fn<(actor: unknown, classId: string) => Promise<{ ok: true; value: Session[] }>>(async () => ({ ok: true, value: [] })),
  },
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
const session_ = (id: string, classId: string, startsAt: string, location = 'Range 2'): Session => ({
  id, classId, className: `Class ${classId}`, startsAt, endsAt: startsAt, location, instructorIds: [], instructors: [], capacity: 10,
} as unknown as Session);

const as = (role: Role) => {
  const camp: Membership = { orgId: 'o1', role, name: 'Lake Camp', slug: 'lake' };
  session.current = { user: { id: 'u1', email: 'priya@example.com', name: 'Priya Nair' }, memberships: [camp] };
  session.camp = camp;
};

beforeEach(() => {
  vi.clearAllMocks();
  services.people.list.mockResolvedValue([person('a', 'valid'), person('b', 'valid'), person('c', 'expired')]);
  services.attendance.onSite.mockResolvedValue([{ personId: 'a' }]);
});

describe('loadCampHome', () => {
  it('reads the camp facts through the services as the actor', async () => {
    as('staff');
    const home = await loadCampHome();
    expect(services.orgs.getCamp).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', role: 'staff' });
    expect(home).toEqual({
      campId: 'o1', name: 'Lake Camp', firstName: 'Priya', canRename: false,
      people: 3, onSite: 1, checkedInToday: 0, validMemberships: 2, upcomingSessions: [],
    });
  });

  it('counts each person once for today, using the camp-local day', async () => {
    as('staff');
    services.attendance.log.mockResolvedValue([{ personId: 'a' }, { personId: 'a' }, { personId: 'b' }]);
    const home = await loadCampHome();
    expect(home.checkedInToday).toBe(2);
    const filter = services.attendance.log.mock.calls[0]?.[1] as { from: string; to: string };
    expect(filter.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filter.to).toBe(filter.from);
  });

  it('lists the next sessions across classes, soonest first, and drops past ones', async () => {
    as('staff');
    services.classes.listClasses.mockResolvedValue({ ok: true, value: [{ id: 'k1' }, { id: 'k2' }] });
    services.classes.listSessions.mockImplementation(async (_actor, classId) => ({
      ok: true as const,
      value: classId === 'k1'
        ? [session_('s-late', 'k1', '2999-01-03T09:00:00Z'), session_('s-past', 'k1', '2000-01-01T09:00:00Z')]
        : [session_('s-soon', 'k2', '2999-01-02T09:00:00Z', 'Lake')],
    }));
    const home = await loadCampHome();
    expect(home.upcomingSessions?.map(s => s.id)).toEqual(['s-soon', 's-late']);
    expect(home.upcomingSessions?.[0]).toEqual({ id: 's-soon', className: 'Class k2', startsAt: '2999-01-02T09:00:00Z', location: 'Lake' });
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

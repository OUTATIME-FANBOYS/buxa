import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Membership, PersonSummary, Session } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import { MAX_LOG_ROWS } from '../../../attendance/AttendanceRepository';

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
}));
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string; name: string }; memberships: Membership[] }, camp: null as Membership | null }));
const services = vi.hoisted(() => ({
  orgs: { getCamp: vi.fn(async () => ({ id: 'o1', name: 'Lake Camp', slug: 'lake', createdAt: '2026-03-04T10:00:00Z', memberCount: 3, timezone: 'UTC' })) },
  people: { list: vi.fn(async (): Promise<PersonSummary[]> => []) },
  attendance: {
    onSite: vi.fn(async (): Promise<{ personId: string; isMinor: boolean | null }[]> => []),
    log: vi.fn<(actor: unknown, filter: { from: string; to: string }) => Promise<{ personId: string; checkedInAt: string }[]>>(async () => []),
  },
  classes: {
    listClasses: vi.fn(async () => ({ ok: true as const, value: [] as { id: string }[] })),
    listSessions: vi.fn<(actor: unknown, classId: string) => Promise<{ ok: true; value: Session[] }>>(async () => ({ ok: true, value: [] })),
  },
}));

vi.mock('next/navigation', () => ({ notFound }));
const repositories = vi.hoisted(() => ({
  people: { getMany: vi.fn(async (): Promise<{ id: string; dateOfBirth: string | null; roles: string[] }[]> => []) },
}));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services, repositories }) }));
vi.mock('../../../session', () => ({
  requireSession: async () => session.current,
  getCurrentCamp: async () => session.camp,
  toActor: (s: { user: { id: string } }, camp: Membership) => ({ userId: s.user.id, orgId: camp.orgId, role: camp.role }),
}));

const { checkInsPerDay, daysBefore, loadCampHome, membershipCounts, onSiteAgeGroups, CHART_DAYS } = await import('../campHome');

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

/** The UTC day of an instant, which is the camp's day in these tests (the org timezone is UTC). */
const TODAY = new Date().toISOString().slice(0, 10);
/** The day `n` days before today. */
const dayOf = (n: number) => daysBefore(TODAY, n);
const visit = (personId: string, day: string) => ({ personId, checkedInAt: `${day}T12:00:00.000Z` });

beforeEach(() => {
  vi.clearAllMocks();
  services.people.list.mockResolvedValue([person('a', 'valid'), person('b', 'valid'), person('c', 'expired')]);
  services.attendance.onSite.mockResolvedValue([{ personId: 'a', isMinor: false }]);
});

describe('loadCampHome', () => {
  it('reads the camp facts through the services as the actor', async () => {
    as('staff');
    const home = await loadCampHome();
    expect(services.orgs.getCamp).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', role: 'staff' });
    expect(home).toEqual({
      campId: 'o1', name: 'Lake Camp', firstName: 'Priya', canRename: false,
      people: 3, onSite: 1, checkedInToday: 0, validMemberships: 2, upcomingSessions: [],
      checkInsByDay: { days: expect.any(Array), complete: true },
      onSiteByAge: { adults: 1, minors: 0 },
      membershipStatus: { valid: 2, notStarted: 0, expired: 1, none: 0 },
    });
  });

  it('counts each person once for today, using the camp-local day, and charts the same day', async () => {
    as('staff');
    const today = dayOf(0);
    services.attendance.log.mockResolvedValue([visit('a', today), visit('a', today), visit('b', today)]);
    const home = await loadCampHome();
    expect(home.checkedInToday).toBe(2);
    expect(home.checkInsByDay?.days[CHART_DAYS - 1]).toEqual({ date: today, count: 2, minors: 0 });
    const filter = services.attendance.log.mock.calls[0]?.[1];
    expect(filter.to).toBe(today);
    expect(filter.from).toBe(dayOf(CHART_DAYS - 1));
  });

  it('gives no check-in chart, no age split and no membership counts to a viewer who may not read them', async () => {
    as('viewer');
    // The service hides status from viewers (null on every row), even though the list itself is readable.
    services.people.list.mockResolvedValue([{ ...person('a', 'valid'), status: null }, { ...person('b', 'expired'), status: null }]);
    const home = await loadCampHome();
    expect(home.onSite).toBeNull();
    expect(home.checkedInToday).toBeNull();
    expect(home.checkInsByDay).toBeNull();
    expect(home.onSiteByAge).toBeNull();
    expect(home.membershipStatus).toBeNull();
    expect(home.validMemberships).toBeNull();
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

describe('checkInsPerDay', () => {
  it('returns one day per entry of the window, oldest first, ending on today, with zeros for quiet days', () => {
    const series = checkInsPerDay([], '2026-11-17', 'UTC', true, null);
    expect(series.days).toHaveLength(CHART_DAYS);
    expect(series.days[0].date).toBe(daysBefore('2026-11-17', CHART_DAYS - 1));
    expect(series.days[CHART_DAYS - 1]).toEqual({ date: '2026-11-17', count: 0, minors: null });
    expect(series.complete).toBe(true);
  });

  it('buckets each visit by its camp-local day, not the UTC day', () => {
    // 23:30 UTC on 16 Nov is already 17 Nov in Auckland (UTC+13 in November).
    const visits = [{ personId: 'a', checkedInAt: '2026-11-16T23:30:00.000Z' }, { personId: 'b', checkedInAt: '2026-11-17T01:00:00.000Z' }];
    const series = checkInsPerDay(visits, '2026-11-17', 'Pacific/Auckland', true, null);
    expect(series.days.at(-1)).toEqual({ date: '2026-11-17', count: 2, minors: null });
    expect(series.days.at(-2)?.count).toBe(0);
  });

  it('counts a person once per day and keeps the complete flag it was given', () => {
    const visits = [{ personId: 'a', checkedInAt: '2026-11-17T08:00:00Z' }, { personId: 'a', checkedInAt: '2026-11-17T09:00:00Z' }];
    expect(checkInsPerDay(visits, '2026-11-17', 'UTC', false, null)).toMatchObject({ complete: false });
    expect(checkInsPerDay(visits, '2026-11-17', 'UTC', true, null).days.at(-1)?.count).toBe(1);
  });

  it('splits each day into students (minors) and the rest, counting a person once', () => {
    const visits = [
      { personId: 'kid', checkedInAt: '2026-11-17T08:00:00Z' }, { personId: 'kid', checkedInAt: '2026-11-17T10:00:00Z' },
      { personId: 'parent', checkedInAt: '2026-11-17T09:00:00Z' }, { personId: 'kid2', checkedInAt: '2026-11-16T09:00:00Z' },
    ];
    const series = checkInsPerDay(visits, '2026-11-17', 'UTC', true, new Set(['kid', 'kid2']));
    expect(series.days.at(-1)).toEqual({ date: '2026-11-17', count: 2, minors: 1 });
    expect(series.days.at(-2)).toEqual({ date: '2026-11-16', count: 1, minors: 1 });
  });
});

describe('loadCampHome age split on the chart', () => {
  it('reads the visitors from the people repository and marks the students, for a role that may see contact details', async () => {
    as('staff');
    const today = dayOf(0);
    services.attendance.log.mockResolvedValue([visit('kid', today), visit('a', today)]);
    repositories.people.getMany.mockResolvedValue([
      { id: 'kid', dateOfBirth: '2016-01-01', roles: ['camper'] }, { id: 'a', dateOfBirth: '1980-01-01', roles: ['staff'] },
    ]);
    const home = await loadCampHome();
    expect(home.checkInsByDay?.days.at(-1)).toEqual({ date: today, count: 2, minors: 1 });
  });
});

describe('daysBefore', () => {
  it('steps back across month and year boundaries', () => {
    expect(daysBefore('2027-01-02', 3)).toBe('2026-12-30');
    expect(daysBefore('2026-03-01', 1)).toBe('2026-02-28');
  });
});

describe('onSiteAgeGroups', () => {
  it('splits the people on site into adults and minors', () => {
    const entries = [{ isMinor: true }, { isMinor: false }, { isMinor: false }] as never;
    expect(onSiteAgeGroups(entries)).toEqual({ adults: 2, minors: 1 });
  });

  it('is zero and zero with nobody on site', () => {
    expect(onSiteAgeGroups([])).toEqual({ adults: 0, minors: 0 });
  });

  it('is null when the minor flag is hidden from the viewer', () => {
    expect(onSiteAgeGroups([{ isMinor: null }, { isMinor: true }] as never)).toBeNull();
  });
});

describe('membershipCounts', () => {
  it('counts each status, folding revoked into none and keeping not started apart', () => {
    const list = [person('a', 'valid'), person('b', 'not_started'), person('c', 'expired'), person('d', 'revoked'), person('e', 'none')];
    expect(membershipCounts(list)).toEqual({ valid: 1, notStarted: 1, expired: 1, none: 2 });
  });

  it('is null when there is no list, or the list hides status', () => {
    expect(membershipCounts(null)).toBeNull();
    expect(membershipCounts([{ ...person('a', 'valid'), status: null }])).toBeNull();
  });

  it('is all zeros for an empty camp list', () => {
    expect(membershipCounts([])).toEqual({ valid: 0, notStarted: 0, expired: 0, none: 0 });
  });
});

describe('loadCampHome when the log is full', () => {
  it('marks the chart incomplete when the read hit its row limit', async () => {
    as('staff');
    const today = dayOf(0);
    services.attendance.log.mockResolvedValue(Array.from({ length: MAX_LOG_ROWS }, (_, i) => visit(`p${i}`, today)));
    const home = await loadCampHome();
    expect(home.checkInsByDay?.complete).toBe(false);
    expect(home.checkedInToday).toBe(MAX_LOG_ROWS);
  });
});

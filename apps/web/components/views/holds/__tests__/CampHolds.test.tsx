import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { forbidden } from '@buxa/server/http/errors';
import { settle } from '@buxa/domain';
import { ConfirmDialog } from '@/components/components';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
const session = vi.hoisted((): { role: Role | null } => ({ role: 'staff' }));
const services = vi.hoisted(() => ({
  seatHolds: { listCampActiveHolds: vi.fn() },
  classes: { listCampWaitlists: vi.fn(), listSessions: vi.fn() },
  orgs: { getCamp: vi.fn() },
}));

vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn() }));
vi.mock('@buxa/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@buxa/server/session/index', () => ({
  requireSession: () => Promise.resolve({ user: { clockFormat: null } }),
}));
vi.mock('@buxa/server/composers/people/camp', () => ({
  currentActor: () => settle(() => (session.role ? { userId: 'u1', orgId: 'o1', role: session.role } : null)),
}));

const { CampHolds } = await import('@/components/views/holds');

const render = (node: ReactNode) => renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}>{node}</UiProvider>);

const EMPTY = 'No one is holding a place right now.';

const hold = {
  id: 'hold-1',
  sessionId: 'session-1',
  sessionName: 'Summer camp',
  classId: 'class-1',
  className: 'Robotics',
  householdId: 'house-1',
  householdName: 'Okafor family',
  childName: 'Ada Okafor',
  createdAt: '2027-07-05T08:50:00.000Z',
  expiresAt: '2027-07-05T09:05:00.000Z',
};

const waiting = {
  enrolmentId: 'enrol-1',
  sessionId: 'session-1',
  sessionName: 'Summer camp',
  classId: 'class-1',
  className: 'Robotics',
  householdName: 'Ito family',
  camperName: 'Ben Ito',
  joinedAt: '2027-07-05T08:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  session.role = 'staff';
  services.orgs.getCamp.mockResolvedValue({ timezone: 'Australia/Sydney' });
  services.seatHolds.listCampActiveHolds.mockResolvedValue([]);
  services.classes.listCampWaitlists.mockResolvedValue([]);
  services.classes.listSessions.mockResolvedValue({ ok: true, value: [] });
});

describe('the camp-wide holds screen', () => {
  it('shows the empty state when no one holds a place', async () => {
    const html = render(await CampHolds());
    expect(html).toContain(EMPTY);
    expect(html).toContain('Nobody is on a waitlist right now.');
    expect(html).not.toContain('<table');
  });

  it('lists each hold with its session, class, family, child and times in camp time, and each waitlist with its place in line', async () => {
    services.seatHolds.listCampActiveHolds.mockResolvedValue([hold]);
    services.classes.listCampWaitlists.mockResolvedValue([waiting]);
    const html = render(await CampHolds());
    expect(html).toContain('Okafor family');
    expect(html).toContain('Ada Okafor');
    expect(html).toContain('Robotics');
    expect(html).toContain('Place in line');
    expect(html).toContain('Ito family');
    expect(html).toContain('Ben Ito');
    // 09:05 UTC is 19:05 in Sydney in July (AEST is UTC+10).
    expect(html).toContain('19:05');
    expect(html).not.toContain(EMPTY);
  });

  it('offers a session filter once there is something to filter', async () => {
    services.seatHolds.listCampActiveHolds.mockResolvedValue([hold]);
    const html = render(await CampHolds());
    expect(html).toContain('All sessions');
    expect(html).toContain('Summer camp');
  });

  it('refuses a viewer or a teacher with a short message, not the holds (the service refuses the read)', async () => {
    session.role = 'viewer';
    services.seatHolds.listCampActiveHolds.mockRejectedValue(forbidden('nope'));
    services.classes.listCampWaitlists.mockRejectedValue(forbidden('nope'));
    const html = render(await CampHolds());
    expect(html).toContain('You cannot see holds');
    expect(html).not.toContain(EMPTY);
  });
});

describe('the session filter on the camp-wide holds screen', () => {
  const SUMMER = 'session-1';
  const WINTER = 'session-2';
  const winterHold = {
    ...hold,
    id: 'hold-2',
    sessionId: WINTER,
    sessionName: 'Winter camp',
    householdName: 'Diaz family',
  };
  const winterWait = {
    ...waiting,
    enrolmentId: 'enrol-2',
    sessionId: WINTER,
    sessionName: 'Winter camp',
    camperName: 'Eve Diaz',
  };
  const session = (id: string, name: string, status: string) => ({
    id,
    name,
    status,
    description: '',
    startsOn: null,
    endsOn: null,
    classCount: 1,
    isPublic: false,
    archivedAt: null,
    createdAt: '2027-01-01T00:00:00.000Z',
  });

  beforeEach(() => {
    services.seatHolds.listCampActiveHolds.mockResolvedValue([hold, winterHold]);
    services.classes.listCampWaitlists.mockResolvedValue([waiting, winterWait]);
    services.classes.listSessions.mockResolvedValue({
      ok: true,
      value: [session(SUMMER, 'Summer camp', 'live'), session(WINTER, 'Winter camp', 'draft')],
    });
  });

  it('narrows both lists to the chosen session', async () => {
    const html = render(await CampHolds({ searchParams: { session: WINTER } }));
    expect(html).toContain('Diaz family');
    expect(html).toContain('Eve Diaz');
    expect(html).not.toContain('Okafor family');
    expect(html).not.toContain('Ben Ito');
  });

  it('shows every session under All sessions (an empty session parameter)', async () => {
    const html = render(await CampHolds({ searchParams: { session: '' } }));
    expect(html).toContain('Okafor family');
    expect(html).toContain('Diaz family');
    expect(html).toContain('Ben Ito');
    expect(html).toContain('Eve Diaz');
  });

  it('carries the choice in the URL: a GET form to the holds address with a session field that has the choice selected', async () => {
    const html = render(await CampHolds({ searchParams: { session: WINTER } }));
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/camp/holds"');
    expect(html).toContain('name="session"');
    expect(html).toMatch(new RegExp(`<option value="${WINTER}"[^>]*selected`));
  });

  it('lists All sessions first, then each session by name', async () => {
    const html = render(await CampHolds({ searchParams: {} }));
    const all = html.indexOf('All sessions');
    const summer = html.indexOf('Summer camp</option>');
    const winter = html.indexOf('Winter camp</option>');
    expect(all).toBeGreaterThanOrEqual(0);
    expect(all).toBeLessThan(summer);
    expect(summer).toBeLessThan(winter);
  });

  it('opens on the one live session when the URL names none', async () => {
    const html = render(await CampHolds({ searchParams: {} }));
    expect(html).toContain('Okafor family');
    expect(html).not.toContain('Diaz family');
    expect(html).toMatch(new RegExp(`<option value="${SUMMER}"[^>]*selected`));
  });
});

import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { forbidden } from '@buxa/server/http/errors';
import { settle } from '@buxa/domain';
import { Dialog as ConfirmDialog } from '@/components/components';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
const session = vi.hoisted((): { role: Role | null } => ({ role: 'staff' }));
const services = vi.hoisted(() => ({
  seatHolds: { listCampActiveHolds: vi.fn() },
  classes: { listCampWaitlists: vi.fn() },
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

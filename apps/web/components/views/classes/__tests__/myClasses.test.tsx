import { Dialog as ConfirmDialog } from '@/components/components';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { settle } from '@buxa/domain';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
const session: { role: Role | 'teacher' | null } = vi.hoisted(() => ({ role: 'teacher' }));
const services = vi.hoisted(() => ({
  classes: { listMyClasses: vi.fn() },
  orgs: { getCamp: vi.fn(), listMembers: vi.fn() },
}));

vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn() }));
vi.mock('@buxa/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@buxa/server/session/index', () => ({
  requireSession: () => Promise.resolve({ user: { clockFormat: null } }),
}));
vi.mock('@buxa/server/composers/people/camp', () => ({
  currentActor: () =>
    settle(() =>
      session.role
        ? {
            userId: 'teacher-1',
            orgId: 'o1',
            role: session.role === 'teacher' ? 'viewer' : session.role,
            instructor: session.role === 'teacher',
          }
        : null,
    ),
}));

const { MyClasses } = await import('@/components/views/classes');

const render = (node: ReactNode) => renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}>{node}</UiProvider>);

const ROBOTICS = {
  id: 'c-robotics',
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 11 },
  startsAt: '2027-07-10T09:00:00Z',
  endsAt: '2027-07-10T12:00:00Z',
  location: 'Lab 2',
};
const CODING = {
  id: 'c-coding',
  name: 'Coding',
  ageRange: { minAge: 12, maxAge: 14 },
  startsAt: '2027-08-02T13:00:00Z',
  endsAt: '2027-08-02T15:00:00Z',
  location: 'Room 4',
};

beforeEach(() => {
  vi.clearAllMocks();
  notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  session.role = 'teacher';
  services.orgs.getCamp.mockResolvedValue({ timezone: 'Australia/Sydney' });
  services.classes.listMyClasses.mockResolvedValue({
    ok: true,
    value: [
      { id: 's-july', name: 'July camp', startsOn: '2027-07-05', endsOn: '2027-07-16', classes: [ROBOTICS] },
      { id: 's-aug', name: 'August camp', startsOn: '2027-08-01', endsOn: '2027-08-14', classes: [CODING] },
    ],
  });
});

describe('MyClasses (the teacher page)', () => {
  it('lists the teacher own classes grouped by session, with time, ages and location', async () => {
    const html = render(await MyClasses());
    expect(html).toContain('My classes');
    expect(html).toContain('July camp');
    expect(html).toContain('2027-07-05 to 2027-07-16');
    expect(html).toContain('Robotics');
    expect(html).toContain('8 to 11');
    expect(html).toContain('Lab 2');
    expect(html.indexOf('July camp')).toBeLessThan(html.indexOf('August camp'));
    expect(html.indexOf('Robotics')).toBeLessThan(html.indexOf('Coding'));
  });

  it('shows the empty state when the teacher has no classes', async () => {
    services.classes.listMyClasses.mockResolvedValue({ ok: true, value: [] });
    const html = render(await MyClasses());
    expect(html).toContain('You are not assigned to any classes yet.');
    expect(html).not.toContain('July camp');
  });

  it('shows nothing a teacher should not see: no seat counts, campers or instructors', async () => {
    const html = render(await MyClasses());
    expect(html).not.toContain('Enrolled');
    expect(html).not.toContain('Waitlisted');
    expect(html).not.toContain('Instructors');
  });

  it('is not found for staff, without calling the service', async () => {
    session.role = 'staff';
    await expect(MyClasses()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(services.classes.listMyClasses).not.toHaveBeenCalled();
  });

  it('is not found when there is no signed-in camp person', async () => {
    session.role = null;
    await expect(MyClasses()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

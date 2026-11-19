import * as React from 'react';
import { Children, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Membership } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import { settle } from '@buxa/domain';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
const session = vi.hoisted(() => ({
  current: null as null | { user: { id: string; email: string; name: string }; memberships: Membership[] },
  camp: null as Membership | null,
}));
const orgs = vi.hoisted(() => ({
  getCamp: vi.fn(() =>
    settle(() => ({ id: 'o1', name: 'Sunrise', slug: 'sunrise', createdAt: '2026-03-04T10:00:00Z', memberCount: 2 })),
  ),
  listMembers: vi.fn(() =>
    settle(() => ({
      members: [
        { id: 'u1', name: 'Maya Chen', email: 'maya@example.com', role: 'owner' },
        { id: 'u2', name: 'Sam Lee', email: 'sam@example.com', role: 'viewer' },
      ],
    })),
  ),
}));

vi.mock('next/navigation', () => ({
  notFound,
  usePathname: () => '/camp',
  useRouter: () => ({ push() {}, refresh() {} }),
}));
vi.mock('@buxa/server/runtime', () => ({ getRuntime: () => ({ services: { orgs } }) }));
vi.mock('@buxa/server/session/index', () => ({
  requireSession: () => settle(() => session.current),
  getCurrentCamp: () => settle(() => session.camp),
  toActor: (s: { user: { id: string } }, camp: Membership) => ({
    userId: s.user.id,
    orgId: camp.orgId,
    role: camp.role,
  }),
}));
vi.mock('@buxa/server/composers/camp/selectCampAction', () => ({ selectCampAction: async () => {} }));
vi.mock('@buxa/server/composers/auth/signOut', () => ({ signOut: async () => {} }));
vi.mock('@/components/components/camp/NewCampForm', () => ({
  NewCampForm: ({ first }: { first: boolean }) => `NEW-CAMP-${first ? 'FIRST' : 'EXTRA'}`,
}));

// Vitest compiles JSX with the classic runtime, which needs React in scope.
Object.assign(globalThis, { React });

const { Members } = await import('@/components/views/camp');
const { CampFrame } = await import('@/components/views/camp');

const as = (role: Role) => {
  const camp: Membership = { orgId: 'o1', role, name: 'Sunrise', slug: 'sunrise' };
  session.current = { user: { id: 'u1', email: 'maya@example.com', name: 'Maya Chen' }, memberships: [camp] };
  session.camp = camp;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Members', () => {
  it('lists the members with their roles', async () => {
    as('viewer');
    const html = renderToStaticMarkup(await Members());
    expect(orgs.listMembers).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', role: 'viewer' });
    expect(html).toContain('Maya Chen');
    expect(html).toContain('2 people have access');
    expect(html).toContain('Owner');
  });
});

const labels = (groups: readonly { items: readonly { label: string }[] }[]) =>
  groups.flatMap(g => g.items.map(i => i.label));

describe('CampFrame', () => {
  const user = {
    id: 'u1',
    email: 'maya@example.com',
    name: 'Maya Chen',
    firstName: 'Maya',
    lastName: 'Chen',
    clockFormat: null,
  };
  const camp: Membership = { orgId: 'o1', role: 'owner', name: 'Sunrise', slug: 'sunrise' };

  it('shows the page inside the frame when there is a camp', () => {
    const frame = CampFrame({ user, camps: [camp], current: camp, children: 'THE-PAGE' });
    expect(labels(frame.props.nav)).toEqual([
      'Home',
      'Sessions',
      'Registration',
      'Check-in',
      'On site',
      'People',
      'Attendance',
      'My tasks',
      'Projects',
      'Boards',
      'Calendar',
      'Agents',
      'Team access',
    ]);
    expect(Children.toArray(frame.props.children)[0]).toBe('THE-PAGE');
  });

  it('shows first-run setup instead of the page when there is no camp', () => {
    const frame = CampFrame({ user, camps: [], current: null, children: 'THE-PAGE' });
    const first = Children.toArray(frame.props.children)[0];
    expect(isValidElement<{ first: boolean }>(first) && first.props).toEqual({ first: true });
    expect(labels(frame.props.nav)).toEqual(['Home', 'My tasks', 'Projects', 'Boards', 'Calendar', 'Agents']);
  });
});

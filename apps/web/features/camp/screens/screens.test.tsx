import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Membership } from '@buxa/contracts';
import type { Role } from '@buxa/domain';

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string; name: string }; memberships: Membership[] }, camp: null as Membership | null }));
const orgs = vi.hoisted(() => ({
  getCamp: vi.fn(async () => ({ id: 'o1', name: 'Sunrise', slug: 'sunrise', createdAt: '2026-03-04T10:00:00Z', memberCount: 2 })),
  listMembers: vi.fn(async () => ({ members: [{ id: 'u1', name: 'Maya Chen', email: 'maya@example.com', role: 'owner' }, { id: 'u2', name: 'Sam Lee', email: 'sam@example.com', role: 'viewer' }] })),
}));

vi.mock('next/navigation', () => ({ notFound, usePathname: () => '/camp', useRouter: () => ({ push() {}, refresh() {} }) }));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services: { orgs } }) }));
vi.mock('@/server/session', () => ({
  requireSession: async () => session.current,
  getCurrentCamp: async () => session.camp,
  toActor: (s: { user: { id: string } }, camp: Membership) => ({ userId: s.user.id, orgId: camp.orgId, role: camp.role }),
}));
vi.mock('@/features/camp/actions', () => ({ selectCampAction: async () => {} }));
vi.mock('@/features/auth', () => ({ signOut: async () => {} }));
vi.mock('../forms/RenameCampButton', () => ({ RenameCampButton: () => 'RENAME-BUTTON' }));
vi.mock('../forms/NewCampForm', () => ({ NewCampForm: ({ first }: { first: boolean }) => `NEW-CAMP-${first ? 'FIRST' : 'EXTRA'}` }));

// Vitest compiles JSX with the classic runtime, which needs React in scope.
Object.assign(globalThis, { React });

const { Overview } = await import('./Overview');
const { Members } = await import('./Members');
const { CampFrame } = await import('./CampFrame');

const as = (role: Role) => {
  const camp: Membership = { orgId: 'o1', role, name: 'Sunrise', slug: 'sunrise' };
  session.current = { user: { id: 'u1', email: 'maya@example.com', name: 'Maya Chen' }, memberships: [camp] };
  session.camp = camp;
};

beforeEach(() => { vi.clearAllMocks(); });

describe('Overview', () => {
  it('reads the camp through the service as the actor and shows it', async () => {
    as('owner');
    const html = renderToStaticMarkup(await Overview());
    expect(orgs.getCamp).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', role: 'owner' });
    expect(html).toContain('Sunrise');
    expect(html).toContain('/sunrise');
    expect(html).toContain('4 Mar 2026');
  });

  it.each([['owner', true], ['admin', true], ['staff', false], ['viewer', false]] as const)('%s sees the rename button: %s', async (role, shown) => {
    as(role);
    expect(renderToStaticMarkup(await Overview()).includes('RENAME-BUTTON')).toBe(shown);
  });

  it('answers not-found when there is no camp', async () => {
    as('owner');
    session.camp = null;
    await expect(Overview()).rejects.toThrow('NEXT_NOT_FOUND');
  });
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

describe('CampFrame', () => {
  const user = { id: 'u1', email: 'maya@example.com', name: 'Maya Chen' };
  const camp: Membership = { orgId: 'o1', role: 'owner', name: 'Sunrise', slug: 'sunrise' };

  it('shows the page inside the frame when there is a camp', () => {
    const frame = CampFrame({ user, camps: [camp], current: camp, children: 'THE-PAGE' });
    expect(JSON.stringify(frame.props.nav.map((i: { label: string }) => i.label))).toBe('["Overview","Members","Staff board"]');
    expect(frame.props.children).toBe('THE-PAGE');
  });

  it('shows first-run setup instead of the page when there is no camp', () => {
    const frame = CampFrame({ user, camps: [], current: null, children: 'THE-PAGE' });
    expect(frame.props.children.props).toEqual({ first: true });
    expect(frame.props.nav.map((i: { label: string }) => i.label)).toEqual(['Staff board']);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from '@buxa/domain';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
const session = vi.hoisted(() => ({
  camp: null as null | { orgId: string; role: 'owner'; name: string; slug: string },
}));

vi.mock('next/navigation', () => ({ notFound }));
vi.mock('@buxa/server/session/index', () => ({
  requireSession: () =>
    settle(() => ({
      user: { id: 'u-1', email: 'rosa@example.com', name: 'Rosa Delgado', firstName: 'Rosa', lastName: 'Delgado' },
      memberships: [],
    })),
  getCurrentCamp: () => settle(() => session.camp),
  toActor: (_s: unknown, camp: { orgId: string; role: 'owner' }) => ({
    userId: 'u-1',
    orgId: camp.orgId,
    role: camp.role,
  }),
}));
vi.mock('@/actions/camp', () => ({ listArchivedCamps: () => Promise.resolve([]) }));

const { default: SettingsRoute } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  session.camp = null;
});

describe('the camp settings page', () => {
  it('answers not-found when the person has no camp, so it never shows the profile', async () => {
    await expect(SettingsRoute()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});

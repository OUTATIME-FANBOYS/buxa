// @vitest-environment jsdom
import { ConfirmDialog } from '@/components/components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { settle } from '@buxa/domain';
import type { ProfileBadgeRow } from '@buxa/shared';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const session = vi.hoisted(() => ({
  current: {
    user: {
      id: 'u-1',
      email: 'rosa@example.com',
      name: 'Rosa Delgado',
      firstName: 'Rosa',
      lastName: 'Delgado',
      clockFormat: '12h' as const,
    },
    // A signed-in person with no camp: no memberships at all.
    memberships: [] as never[],
  },
}));
const requireSession = vi.hoisted(() => vi.fn(() => settle(() => session.current)));
const getCurrentCamp = vi.hoisted(() => vi.fn(() => settle(() => null)));
vi.mock('@buxa/server/session/index', () => ({ requireSession, getCurrentCamp }));

// The badge section's data: the server lists names and flags only, never a code. A guardian's list includes each child.
const badgeData = vi.hoisted(() => ({
  current: { campName: null as string | null, badges: [] as ProfileBadgeRow[] },
}));
vi.mock('@buxa/server/composers/people/loadProfileBadges', () => ({
  loadProfileBadges: () => settle(() => badgeData.current),
}));

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
  usePathname: () => '/account',
}));
vi.mock('@/actions/account', () => ({
  updateProfileAction: () => Promise.resolve({ status: 'success', message: 'Profile saved' }),
  updateTimeFormatAction: () => Promise.resolve({ status: 'success', message: 'Time format saved' }),
}));
vi.mock('@/components/components/camp/useAppearance', () => ({
  useAppearance: () => ['system', () => undefined],
}));

const { default: AccountPage } = await import('./page');

const seed = buildSeed();

describe('the account page, for a signed-in person with no camp', () => {
  let root: Root;

  beforeEach(() => {
    h.store = {
      s: { ...seed, ui: { ...seed.ui, agentsEnabled: false, theme: 'system' } },
      agents: [],
      actions: { updateProfile: () => undefined, exportData: () => '{}' },
      me: null,
      workspace: null,
      project: null,
      projects: [],
      wsTasks: [],
      kindOf: () => 'open',
      members: [],
      myRole: 'viewer',
      readOnly: false,
      userById: () => undefined,
      saveStatus: 'saved',
      sync: 'local',
    };
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });

  it('renders the profile heading, with the name, email, time format and appearance cards', async () => {
    const element = await AccountPage();
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}>{element}</UiProvider>));

    expect(document.querySelector('h1')?.textContent).toBe('Profile');
    const titles = Array.from(document.querySelectorAll('.settings-grid > section.panel h2')).map(h => h.textContent);
    expect(titles).toEqual(['Display name', 'Email', 'Time format', 'Appearance']);
    const first = document.querySelector<HTMLInputElement>('input[autocomplete="given-name"]');
    expect(first?.value).toBe('Rosa');
    expect(document.querySelector<HTMLInputElement>('input[autocomplete="family-name"]')?.value).toBe('Delgado');
    expect(
      Array.from(document.querySelectorAll<HTMLInputElement>('input')).some(i => i.value === 'rosa@example.com'),
    ).toBe(true);
  });

  it('needs a session, not a camp: the page reads the session and never asks for the camp', async () => {
    await AccountPage();
    expect(requireSession).toHaveBeenCalled();
    expect(getCurrentCamp).not.toHaveBeenCalled();
  });

  it('shows a guardian the badge of each child, with a Show button, and no badge section when there is no camp', async () => {
    badgeData.current = {
      campName: 'Camp Birchwood',
      badges: [{ personId: 'child-1', name: 'Cal Lee', roleLabel: 'Participant', hasActiveBadge: true, self: false }],
    };
    const element = await AccountPage();
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}>{element}</UiProvider>));

    const section = document.querySelector('.profile-badges');
    expect(section?.textContent).toContain('Cal Lee');
    expect(Array.from(section?.querySelectorAll('button') ?? []).map(b => b.textContent)).toContain('Show badge');

    badgeData.current = { campName: null, badges: [] };
    const bare = await AccountPage();
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}>{bare}</UiProvider>));
    expect(document.querySelector('.profile-badges')).toBeNull();
  });

  it('has no camp settings on it', async () => {
    const element = await AccountPage();
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}>{element}</UiProvider>));

    expect(document.body.textContent).not.toContain('Archived camps');
    expect(document.body.textContent).not.toContain('Danger zone');
    expect(document.body.textContent).not.toContain('Agents');
  });
});

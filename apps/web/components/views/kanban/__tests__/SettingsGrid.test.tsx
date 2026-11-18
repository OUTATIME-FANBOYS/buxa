// @vitest-environment jsdom
import { Dialog as ConfirmDialog } from '@/components/components/export';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { SettingsPage } from '@/components/views/kanban/export';
import { CampClockPanel } from '@/components/components/camp/export';

const saveName = vi.hoisted(() =>
  vi.fn<
    (input: {
      firstName: string;
      lastName?: string;
    }) => Promise<{ status: string; message: string; fieldErrors?: object }>
  >(() => Promise.resolve({ status: 'success', message: 'Profile saved' })),
);
const saveTime = vi.hoisted(() =>
  vi.fn<(input: { clockFormat: string }) => Promise<{ status: string; message: string }>>(() =>
    Promise.resolve({ status: 'success', message: 'Time format saved' }),
  ),
);
vi.mock('@/actions/account', () => ({ updateProfileAction: saveName, updateTimeFormatAction: saveTime }));

vi.mock('@/actions/camp', () => ({
  updateCampClockAction: async () => ({ status: 'idle' }),
  archiveCamp: async () => ({ ok: true }),
  deleteCamp: async () => ({ ok: true }),
  unarchiveCamp: async () => ({ ok: true }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
  usePathname: () => '/camp/settings',
}));

const seed = buildSeed();
const USER = {
  id: 'u-1',
  email: 'rosa@example.com',
  name: 'Rosa Delgado',
  firstName: 'Rosa',
  lastName: 'Delgado',
  clockFormat: '12h' as const,
};
/** The tiles every camp's settings show, in order (the camp clock, which has an h3 not an h2, is added in the tests that pass it). */
const TILES = ['Name and email', 'Time format', 'Agents', 'Your data', 'Keyboard shortcuts', 'Archived camps'];
const OWNER_CAMP = { id: 'o-1', name: 'Camp Birchwood', canDelete: true, archived: false };

describe('the settings page', () => {
  let root: Root;
  let updateProfile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateProfile = vi.fn();
    h.store = {
      s: { ...seed, ui: { ...seed.ui, agentsEnabled: false, theme: 'system' } },
      agents: [],
      actions: { updateProfile, exportData: () => '{}', setTheme() {}, setAgentsEnabled() {} },
      me: { id: 'u-1', name: 'Rosa Delgado', title: 'Coordinator', email: 'rosa@example.com' },
      workspace: null,
      project: null,
      projects: [],
      wsTasks: [],
      kindOf: () => 'open',
      members: [],
      myRole: 'owner',
      readOnly: false,
      userById: () => undefined,
      saveStatus: 'saved',
      sync: 'local',
    };
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    saveName.mockClear();
    saveTime.mockClear();
  });

  const render = (
    clock?: ReactNode,
    extra: {
      camp?: typeof OWNER_CAMP;
      archivedCamps?: { id: string; name: string; archivedAt: string; role: 'viewer' | 'staff' | 'admin' | 'owner' }[];
      user?: typeof USER;
    } = {},
  ) =>
    act(() =>
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <SettingsPage clock={clock} camp={extra.camp} archivedCamps={extra.archivedCamps} user={extra.user ?? USER} />
        </UiProvider>,
      ),
    );
  const tiles = () => Array.from(document.querySelectorAll<HTMLElement>('.settings-grid > section.panel'));
  const titles = () => tiles().map(tile => tile.querySelector('h2, h3')?.textContent);
  const tile = (title: string) => tiles().find(t => t.querySelector('h2, h3')?.textContent === title)!;

  it('puts every setting in one grid of tiles, with the page title above it', () => {
    render();
    expect(document.querySelector('h1')?.textContent).toBe('Settings');
    expect(titles()).toEqual(TILES);
    expect(document.querySelector('.settings-page .settings-grid')).not.toBeNull();
  });

  it('has no Appearance control: light, dark and system are chosen in the account menu', () => {
    render(<CampClockPanel campId="c-1" clockFormat="24h" canChange />);
    expect(titles()).not.toContain('Appearance');
    expect(document.body.textContent).not.toContain('Appearance');
    const labels = Array.from(document.querySelectorAll('[role="radio"]')).map(b => b.textContent);
    expect(labels).not.toContain('Light');
    expect(labels).not.toContain('Dark');
    expect(labels).not.toContain('System');
  });

  it('lays out the name and email tile full width, and the time format and camp clock tiles as halves', () => {
    render(<CampClockPanel campId="c-1" clockFormat="24h" canChange />);
    expect(tile('Name and email').classList).toContain('settings-tile--full');
    expect(tile('Time format').classList).toContain('settings-tile--half');
    expect(tile('Camp clock').classList).toContain('settings-tile--half');
    expect(tile('Agents').classList).not.toContain('settings-tile--full');
  });

  it('keeps the camp clock on its own tile with its save action', () => {
    render(<CampClockPanel campId="c-1" clockFormat="24h" canChange />);
    const clock = tile('Camp clock');
    expect(clock.querySelector('#camp-clock-title')?.textContent).toBe('Camp clock');
    expect(clock.querySelector('form')).not.toBeNull();
    expect(Array.from(clock.querySelectorAll('button')).find(b => b.textContent === 'Save clock')).toBeDefined();
  });

  it('shows the full name and the email, with the email marked read-only', () => {
    render();
    const card = tile('Name and email');
    expect(card.querySelector('#profile')).toBeNull();
    expect(card.id).toBe('profile');
    expect(card.textContent).toContain('Rosa Delgado');
    expect(card.textContent).toContain('rosa@example.com');
    expect(card.textContent).toContain('can’t be changed here');
    expect(card.querySelector('input[disabled]')).toBeNull();
  });

  it('updates the display name through the dialog: first and last name, saved to the account, then the board', async () => {
    render();
    act(() => {
      Array.from(tile('Name and email').querySelectorAll<HTMLButtonElement>('button'))
        .find(b => b.textContent === 'Update display name')
        ?.click();
    });
    const first = document.querySelector<HTMLInputElement>('input[maxlength="60"]');
    const dialog =
      document.querySelector<HTMLElement>('#update-display-name-title')?.closest('[role="dialog"]') ?? document.body;
    expect(dialog.textContent).toContain('First name');
    expect(dialog.textContent).toContain('Last name');
    expect(first?.value).toBe('Rosa');
    const form = dialog.querySelector<HTMLFormElement>('form');
    expect(form).not.toBeNull();
    await act(async () => {
      Array.from(form?.querySelectorAll<HTMLButtonElement>('button') ?? [])
        .find(b => b.textContent?.includes('Save profile'))
        ?.click();
    });
    expect(saveName).toHaveBeenCalledWith({ firstName: 'Rosa', lastName: 'Delgado' });
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Rosa Delgado', title: 'Coordinator' });
  });

  it('does not change the board when the account refuses the first name', async () => {
    saveName.mockResolvedValueOnce({
      status: 'error',
      message: 'Check the highlighted fields.',
      fieldErrors: { firstName: 'Enter your first name.' },
    });
    render();
    act(() => {
      Array.from(tile('Name and email').querySelectorAll<HTMLButtonElement>('button'))
        .find(b => b.textContent === 'Update display name')
        ?.click();
    });
    const dialog =
      document.querySelector<HTMLElement>('#update-display-name-title')?.closest('[role="dialog"]') ?? document.body;
    await act(async () => {
      dialog
        .querySelector<HTMLFormElement>('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(updateProfile).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Enter your first name.');
  });

  it('saves the time format from the half tile, and shows the saved choice', async () => {
    render();
    const group = tile('Time format').querySelector('[role="radiogroup"]');
    const checked = Array.from(group?.querySelectorAll('[role="radio"]') ?? []).find(
      b => b.getAttribute('aria-checked') === 'true',
    );
    expect(checked?.textContent).toBe('12-hour (9:05 AM)');
    const twentyFour = Array.from(group?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []).find(
      b => b.textContent === '24-hour (09:05)',
    );
    await act(async () => {
      twentyFour?.click();
    });
    expect(saveTime).toHaveBeenCalledWith({ clockFormat: '24h' });
  });

  it('keeps the Agents, data and shortcut tiles', () => {
    render();
    expect(tile('Agents').textContent).toContain('Turn on agents');
    expect(tile('Your data').textContent).toContain('Export JSON');
    expect(tile('Keyboard shortcuts').textContent).toContain('Create a task');
  });

  it('shows the danger zone at the bottom of the grid to the owner only', () => {
    render(undefined, { camp: OWNER_CAMP });
    expect(titles()).toEqual([...TILES, 'Danger zone']);
    expect(tiles().at(-1)?.querySelector('h2')?.textContent).toBe('Danger zone');
    expect(Array.from(document.querySelectorAll('button')).map(b => b.textContent)).toEqual(
      expect.arrayContaining(['Archive camp', 'Delete camp']),
    );
  });

  it('hides the danger zone from a camp admin who is not the owner', () => {
    render(undefined, { camp: { ...OWNER_CAMP, canDelete: false } });
    expect(titles()).toEqual(TILES);
    expect(document.querySelector('.danger-zone')).toBeNull();
  });

  it('lists archived camps read-only, with the name and the archived date', () => {
    render(undefined, {
      archivedCamps: [{ id: 'o-9', name: 'Camp Cedar', archivedAt: '2026-10-02T09:00:00.000Z', role: 'admin' }],
    });
    const card = document.querySelector('#archived-camps');
    expect(card?.querySelector('h2')?.textContent).toBe('Archived camps');
    expect(card?.querySelector('.archived-list')?.textContent).toContain('Camp Cedar');
    expect(card?.querySelector('.archived-list')?.textContent).toContain('Archived Oct 2, 2026');
    expect(card?.querySelectorAll('button').length).toBe(0);
  });

  it('gives an owner of an archived camp Unarchive and Delete camp, and no one else those buttons', () => {
    render(undefined, {
      archivedCamps: [
        { id: 'o-9', name: 'Camp Cedar', archivedAt: '2026-10-02T09:00:00.000Z', role: 'owner' },
        { id: 'o-8', name: 'Camp Birch', archivedAt: '2026-10-03T09:00:00.000Z', role: 'staff' },
      ],
    });
    const rows = Array.from(document.querySelectorAll('#archived-camps .archived-list li'));
    const labels = (row: Element) => Array.from(row.querySelectorAll('button')).map(b => b.textContent?.trim());

    expect(labels(rows[0])).toEqual(['Unarchive camp', 'Delete camp']);
    expect(labels(rows[1])).toEqual([]);
  });

  it('gives the Save profile button its icon', () => {
    render();
    act(() => {
      Array.from(tile('Name and email').querySelectorAll<HTMLButtonElement>('button'))
        .find(b => b.textContent === 'Update display name')
        ?.click();
    });
    const save = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Save profile');

    expect(save?.querySelector('svg[class*="lucide-save"]')).not.toBeNull();
  });

  it('shows no danger zone for an archived camp, even to its owner', () => {
    render(undefined, { camp: { ...OWNER_CAMP, archived: true } });
    expect(document.querySelector('.danger-zone')).toBeNull();
  });

  it('hides the write actions for an archived camp (read-only, like a viewer)', () => {
    h.store = { ...h.store, readOnly: true, s: { ...seed, ui: { ...seed.ui, agentsEnabled: true, theme: 'system' } } };
    render();
    const labels = Array.from(document.querySelectorAll('button')).map(b => b.textContent);
    expect(labels).not.toContain('Import JSON');
    expect(labels).not.toContain('Add an agent');
    expect(labels).toContain('Export JSON');
  });
});

describe('the settings layout styles', () => {
  // Vitest runs from the repository root (npm test), so the stylesheet is read from there.
  const css = readFileSync(resolve(process.cwd(), 'apps/web/styles/features/settings.css'), 'utf8');

  it('defines the full-width and half-width tile classes', () => {
    expect(css).toMatch(/\.settings-grid > \.settings-tile--full\s*{[^}]*grid-column:\s*1 \/ -1/);
    expect(css).toMatch(/\.settings-grid > \.settings-tile--half\s*{/);
  });

  it('puts tiles side by side from 900px, and stacks them below it', () => {
    expect(css).toMatch(/@media \(min-width: 900px\)\s*{\s*\.settings-grid\s*{\s*grid-template-columns:\s*repeat\(2,/);
    expect(css).not.toContain('min-width: 1280px');
  });
});

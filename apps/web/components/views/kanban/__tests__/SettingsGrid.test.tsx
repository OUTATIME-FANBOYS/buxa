// @vitest-environment jsdom
import { Dialog as ConfirmDialog } from '@/components/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { SettingsPage } from '@/components/views/kanban';

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
/** The cards every camp's settings show, in order: the three personal cards first, then the rest. */
const TILES = [
  'Name and email',
  'Time format',
  'Appearance',
  'Agents',
  'Your data',
  'Keyboard shortcuts',
  'Archived camps',
];
const OWNER_CAMP = { id: 'o-1', name: 'Camp Birchwood', canDelete: true, archived: false };

describe('the settings page', () => {
  let root: Root;
  let updateProfile: ReturnType<typeof vi.fn>;
  let setTheme: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateProfile = vi.fn();
    setTheme = vi.fn();
    h.store = {
      s: { ...seed, ui: { ...seed.ui, agentsEnabled: false, theme: 'system' } },
      agents: [],
      actions: { updateProfile, exportData: () => '{}', setTheme, setAgentsEnabled() {} },
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
    saveName.mockReset();
    saveName.mockResolvedValue({ status: 'success', message: 'Profile saved' });
    saveTime.mockClear();
  });

  const render = (
    extra: {
      camp?: typeof OWNER_CAMP;
      archivedCamps?: { id: string; name: string; archivedAt: string; role: 'viewer' | 'staff' | 'admin' | 'owner' }[];
      user?: typeof USER;
    } = {},
  ) =>
    act(() =>
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <SettingsPage camp={extra.camp} archivedCamps={extra.archivedCamps} user={extra.user ?? USER} />
        </UiProvider>,
      ),
    );
  const tiles = () => Array.from(document.querySelectorAll<HTMLElement>('.settings-grid > section.panel'));
  const titles = () => tiles().map(tile => tile.querySelector('h2, h3')?.textContent);
  const tile = (title: string) => tiles().find(t => t.querySelector('h2, h3')?.textContent === title)!;
  const buttonIn = (card: HTMLElement, label: string) =>
    Array.from(card.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.trim() === label);

  it('puts every setting in one grid of cards, with the page title above it', () => {
    render();
    expect(document.querySelector('h1')?.textContent).toBe('Settings');
    expect(titles()).toEqual(TILES);
    expect(document.querySelector('.settings-page .settings-grid')).not.toBeNull();
  });

  it('has no Camp clock card and no second clock control', () => {
    render();
    expect(titles()).not.toContain('Camp clock');
    expect(document.body.textContent).not.toContain('Camp clock');
    expect(document.body.textContent).not.toContain('Save clock');
    expect(document.querySelector('#camp-clock-title')).toBeNull();
  });

  it('shows no Language or Timezone card', () => {
    render();
    expect(titles()).not.toContain('Language');
    expect(titles()).not.toContain('Timezone');
  });

  it('lays out name and email full width, and time format and appearance side by side as halves', () => {
    render();
    expect(tile('Name and email').classList).toContain('settings-tile--full');
    expect(tile('Time format').classList).toContain('settings-tile--half');
    expect(tile('Appearance').classList).toContain('settings-tile--half');
    expect(tile('Agents').classList).not.toContain('settings-tile--full');
  });

  it('puts Appearance straight after Time format', () => {
    render();
    expect(titles().slice(0, 3)).toEqual(['Name and email', 'Time format', 'Appearance']);
  });

  it('has two rows in the name and email card: the display name with its inputs, then a read-only email', () => {
    render();
    const card = tile('Name and email');
    expect(card.id).toBe('profile');
    const rows = Array.from(card.querySelectorAll('.settings-row'));
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('input[autocomplete="given-name"]')).not.toBeNull();
    expect(rows[0].querySelector('input[autocomplete="family-name"]')).not.toBeNull();
    expect(rows[1].querySelector('input')).toBeNull();
    expect(rows[1].querySelector('button')).toBeNull();
    expect(rows[1].textContent).toContain('rosa@example.com');
    expect(rows[1].textContent).toContain('Your email comes from your sign-in and can’t be changed here.');
  });

  it('has no Update display name button and no dialog', () => {
    render();
    expect(document.body.textContent).not.toContain('Update display name');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(buttonIn(tile('Name and email'), 'Update')).toBeDefined();
  });

  it('saves the name from the Update button beside the inputs, then the board', async () => {
    render();
    const card = tile('Name and email');
    expect(card.querySelector<HTMLInputElement>('input[autocomplete="given-name"]')?.value).toBe('Rosa');
    await act(async () => {
      buttonIn(card, 'Update')?.click();
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
    await act(async () => {
      buttonIn(tile('Name and email'), 'Update')?.click();
    });
    expect(updateProfile).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Enter your first name.');
  });

  it('saves the time format at once when a choice is made, and shows the choice', async () => {
    render();
    const group = tile('Time format').querySelector('[role="radiogroup"]');
    const radios = Array.from(group?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? []);
    expect(radios.find(r => r.checked)?.value).toBe('12h');
    const twentyFour = radios.find(r => r.value === '24h');
    await act(async () => {
      twentyFour?.click();
    });
    expect(saveTime).toHaveBeenCalledWith({ clockFormat: '24h' });
    expect(radios.find(r => r.value === '24h')?.checked).toBe(true);
  });

  it('has no Save button in the time format card', () => {
    render();
    expect(buttonIn(tile('Time format'), 'Save')).toBeUndefined();
    expect(buttonIn(tile('Time format'), 'Save time format')).toBeUndefined();
  });

  it('offers System, Light and Dark in the appearance card, applied at once through the theme action', async () => {
    render();
    const group = tile('Appearance').querySelector('[role="radiogroup"]');
    const radios = Array.from(group?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? []);
    expect(radios.map(r => r.value)).toEqual(['system', 'light', 'dark']);
    expect(radios.find(r => r.checked)?.value).toBe('system');
    await act(async () => {
      radios.find(r => r.value === 'dark')?.click();
    });
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('keeps the Agents, data and shortcut cards', () => {
    render();
    expect(tile('Agents').textContent).toContain('Turn on agents');
    expect(tile('Your data').textContent).toContain('Export JSON');
    expect(tile('Keyboard shortcuts').textContent).toContain('Create a task');
  });

  it('shows the danger zone at the bottom of the grid to the owner only', () => {
    render({ camp: OWNER_CAMP });
    expect(titles()).toEqual([...TILES, 'Danger zone']);
    expect(tiles().at(-1)?.querySelector('h2')?.textContent).toBe('Danger zone');
    expect(Array.from(document.querySelectorAll('button')).map(b => b.textContent)).toEqual(
      expect.arrayContaining(['Archive camp', 'Delete camp']),
    );
  });

  it('hides the danger zone from a camp admin who is not the owner', () => {
    render({ camp: { ...OWNER_CAMP, canDelete: false } });
    expect(titles()).toEqual(TILES);
    expect(document.querySelector('.danger-zone')).toBeNull();
  });

  it('lists archived camps read-only, with the name and the archived date', () => {
    render({
      archivedCamps: [{ id: 'o-9', name: 'Camp Cedar', archivedAt: '2026-10-02T09:00:00.000Z', role: 'admin' }],
    });
    const card = document.querySelector('#archived-camps');
    expect(card?.querySelector('h2')?.textContent).toBe('Archived camps');
    expect(card?.querySelector('.archived-list')?.textContent).toContain('Camp Cedar');
    expect(card?.querySelector('.archived-list')?.textContent).toContain('Archived Oct 2, 2026');
    expect(card?.querySelectorAll('button').length).toBe(0);
  });

  it('gives an owner of an archived camp Unarchive and Delete camp, and no one else those buttons', () => {
    render({
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

  it('shows no danger zone for an archived camp, even to its owner', () => {
    render({ camp: { ...OWNER_CAMP, archived: true } });
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

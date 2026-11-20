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
import { ROUTES } from '@/config/routes';

vi.mock('@/actions/camp', () => ({
  archiveCamp: () => Promise.resolve({ ok: true }),
  deleteCamp: () => Promise.resolve({ ok: true }),
  unarchiveCamp: () => Promise.resolve({ ok: true }),
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
/** The camp cards, in order. The person's own cards (name, email, time format, appearance) are on the profile page. */
const TILES = ['Agents', 'Your data', 'Keyboard shortcuts', 'Archived camps'];
const OWNER_CAMP = {
  id: 'o-1',
  name: 'Camp Birchwood',
  canDelete: true,
  canManageFeed: false,
  isTeacher: false,
  archived: false,
};

describe('the camp settings page', () => {
  let root: Root;

  beforeEach(() => {
    h.store = {
      s: { ...seed, ui: { ...seed.ui, agentsEnabled: false, theme: 'system' } },
      agents: [],
      actions: { exportData: () => '{}', setAgentsEnabled() {} },
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
  });

  const render = (
    extra: {
      camp?: typeof OWNER_CAMP;
      archivedCamps?: { id: string; name: string; archivedAt: string; role: 'viewer' | 'staff' | 'admin' | 'owner' }[];
    } = {},
  ) =>
    act(() =>
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <SettingsPage camp={extra.camp} archivedCamps={extra.archivedCamps} />
        </UiProvider>,
      ),
    );
  const tiles = () => Array.from(document.querySelectorAll<HTMLElement>('.settings-grid > section.panel'));
  const titles = () => tiles().map(tile => tile.querySelector('h2, h3')?.textContent);
  const tile = (title: string) => {
    const found = tiles().find(t => t.querySelector('h2, h3')?.textContent === title);
    if (!found) {
      throw new Error(`No settings tile titled "${title}".`);
    }

    return found;
  };

  it('puts every camp setting in one grid of cards, with the page title above it', () => {
    render();
    expect(document.querySelector('h1')?.textContent).toBe('Settings');
    expect(titles()).toEqual(TILES);
    expect(document.querySelector('.settings-page .settings-grid')).not.toBeNull();
  });

  it('links to the profile page from the top of the page', () => {
    render();
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).find(
      a => a.textContent?.trim() === 'Your profile',
    );
    expect(link?.getAttribute('href')).toBe(ROUTES.account);
  });

  it('has no profile cards: name, email, time format and appearance live on the profile page', () => {
    render();
    expect(titles()).not.toContain('Display name');
    expect(titles()).not.toContain('Email');
    expect(titles()).not.toContain('Time format');
    expect(titles()).not.toContain('Appearance');
    expect(document.querySelector('#display-name-title')).toBeNull();
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
  // The layout is Tailwind utilities on the markup. Vitest runs from the repository root (npm test), so the files are read from there.
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
  const page = read('apps/web/components/views/kanban/Settings.tsx');
  const classes = read('apps/web/components/components/settings/styles.ts');

  it('defines one full-width column, with no half-width tiles', () => {
    expect(classes).toMatch(/SETTINGS_GRID = '[^']*buxa:grid-cols-\[minmax\(0,1fr\)\]/);
    expect(page).toContain('className={`settings-grid ${SETTINGS_GRID}`}');
    expect(page).not.toContain('settings-tile--half');
  });

  it('keeps the cards stacked at every width', () => {
    expect(classes).not.toMatch(/SETTINGS_GRID = '[^']*repeat\(2/);
    expect(classes).not.toContain('1280px');
    expect(page).not.toContain('1280px');
  });
});

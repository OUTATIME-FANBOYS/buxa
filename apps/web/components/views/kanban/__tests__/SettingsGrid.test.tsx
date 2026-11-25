// @vitest-environment jsdom
import { ConfirmDialog } from '@/components/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { SettingsPage } from '@/components/views/kanban';
import { ROUTES } from '@/config/routes';

const camp = vi.hoisted(() => ({
  rename: vi.fn<(previous: unknown, form: FormData) => Promise<{ status: string }>>(() =>
    Promise.resolve({ status: 'success' }),
  ),
}));

vi.mock('@/actions/camp', () => ({
  archiveCamp: () => Promise.resolve({ ok: true }),
  deleteCamp: () => Promise.resolve({ ok: true }),
  unarchiveCamp: () => Promise.resolve({ ok: true }),
  renameCampAction: camp.rename,
  setHoldLengthAction: () => Promise.resolve({ status: 'success' }),
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
const TILES = ['Agents', 'Your data', 'Keyboard shortcuts'];
const OWNER_CAMP = {
  id: 'o-1',
  name: 'Camp Birchwood',
  holdMinutes: null,
  canRename: true,
  canArchive: true,
  canDelete: true,
  canManageFeed: false,
  isInstructor: false,
  archived: false,
};
/** An admin: may rename and archive (org:update, org:archive), but not delete (org:delete is the owner's). */
const ADMIN_CAMP = { ...OWNER_CAMP, canDelete: false };
/** Staff and teachers: no rename, archive or delete, so no camp name card and no danger zone. */
const STAFF_CAMP = { ...OWNER_CAMP, canRename: false, canArchive: false, canDelete: false };

function must<T>(value: T | null | undefined, what: string): T {
  if (value == null) {
    throw new Error(`Expected ${what} on the page.`);
  }

  return value;
}
/** Types into a field through the native setter, so React sees the change. */
const typeInto = (input: HTMLInputElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
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

  it('shows the camp name card first, and the danger zone at the bottom, to the owner', () => {
    render({ camp: OWNER_CAMP });
    expect(titles()).toEqual(['Camp name', 'Seat hold length', ...TILES, 'Danger zone']);
    expect(tiles().at(-1)?.querySelector('h2')?.textContent).toBe('Danger zone');
    const labels = Array.from(document.querySelectorAll('.danger-zone button')).map(b => b.textContent);
    expect(labels).toEqual(['Archive camp', 'Delete camp']);
  });

  it('gives an admin Archive camp in the danger zone, but no Delete camp', () => {
    render({ camp: ADMIN_CAMP });
    expect(titles()).toEqual(['Camp name', 'Seat hold length', ...TILES, 'Danger zone']);
    const labels = Array.from(document.querySelectorAll('.danger-zone button')).map(b => b.textContent);
    expect(labels).toEqual(['Archive camp']);
  });

  it('hides the camp name card and the danger zone from a role that cannot rename, archive or delete', () => {
    render({ camp: STAFF_CAMP });
    expect(titles()).toEqual(TILES);
    expect(document.querySelector('.danger-zone')).toBeNull();
  });

  it('renames the camp inline from the camp name card: the current name in a field, an Update button, no dialog', async () => {
    render({ camp: OWNER_CAMP });
    const card = tile('Camp name');
    const input = must(card.querySelector<HTMLInputElement>('input[name="name"]'), 'the camp name field');
    expect(input.value).toBe('Camp Birchwood');
    expect(card.querySelector('button')?.textContent).toBe('Update');
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    act(() => typeInto(input, 'Camp Cedar'));
    act(() => {
      must(card.querySelector<HTMLFormElement>('form'), 'the camp name form').requestSubmit();
    });
    await act(() => Promise.resolve());
    expect(camp.rename).toHaveBeenCalledTimes(1);
    const form = camp.rename.mock.calls[0]?.[1];
    expect(form?.get('name')).toBe('Camp Cedar');
    expect(form?.get('campId')).toBe('o-1');
  });

  it('lists archived camps read-only, with the name and the archived date', () => {
    render({
      archivedCamps: [{ id: 'o-9', name: 'Camp Cedar', archivedAt: '2026-10-02T09:00:00.000Z', role: 'admin' }],
    });
    const card = document.querySelector('#archived-camps');
    expect(card?.querySelector('h2')?.textContent).toBe('Archived camps');
    expect(card?.querySelector('tbody')?.textContent).toContain('Camp Cedar');
    expect(card?.querySelector('tbody')?.textContent).toContain('Oct 2, 2026');
    expect(card?.querySelector('tbody .row-title')?.textContent).toBe('Camp Cedar');
    expect(card?.querySelectorAll('button').length).toBe(1);
  });

  it('gives an owner of an archived camp Unarchive and Delete camp, and no one else those buttons', () => {
    render({
      archivedCamps: [
        { id: 'o-9', name: 'Camp Cedar', archivedAt: '2026-10-02T09:00:00.000Z', role: 'owner' },
        { id: 'o-8', name: 'Camp Birch', archivedAt: '2026-10-03T09:00:00.000Z', role: 'staff' },
      ],
    });
    const rows = Array.from(document.querySelectorAll('#archived-camps tbody tr'));
    const labels = (row: Element) =>
      Array.from(row.querySelectorAll('button'))
        .map(b => b.textContent?.trim())
        .filter(text => text !== 'Camp Cedar' && text !== 'Camp Birch');

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

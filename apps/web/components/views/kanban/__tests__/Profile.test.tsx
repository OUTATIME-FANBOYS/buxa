// @vitest-environment jsdom
import { Dialog as ConfirmDialog } from '@/components/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { Profile } from '@/components/views/kanban';

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
const appearance = vi.hoisted(() => ({ theme: 'system', choose: vi.fn() }));
vi.mock('@/components/components/camp/useAppearance', () => ({
  useAppearance: () => [appearance.theme, appearance.choose],
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
  usePathname: () => '/account',
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
/** The profile cards, in order: the person's name, email, time format and appearance. */
const TILES = ['Display name', 'Email', 'Time format', 'Appearance'];

describe('the profile page', () => {
  let root: Root;
  let updateProfile: ReturnType<typeof vi.fn>;
  let setTheme: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateProfile = vi.fn();
    setTheme = vi.fn();
    appearance.theme = 'system';
    appearance.choose.mockClear();
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

  const render = (user = USER) =>
    act(() =>
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <Profile user={user} />
        </UiProvider>,
      ),
    );
  const tiles = () => Array.from(document.querySelectorAll<HTMLElement>('.settings-grid > section.panel'));
  const titles = () => tiles().map(tile => tile.querySelector('h2, h3')?.textContent);
  const tile = (title: string) => {
    const found = tiles().find(t => t.querySelector('h2, h3')?.textContent === title);
    if (!found) {
      throw new Error(`No profile tile titled "${title}".`);
    }

    return found;
  };
  const buttonIn = (card: HTMLElement, label: string) =>
    Array.from(card.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.trim() === label);

  it('shows the profile heading and the four personal cards, in one grid', () => {
    render();
    expect(document.querySelector('h1')?.textContent).toBe('Profile');
    expect(titles()).toEqual(TILES);
    expect(document.querySelector('.settings-page .settings-grid')).not.toBeNull();
  });

  it('has no camp cards and no Agents or data cards', () => {
    render();
    expect(document.body.textContent).not.toContain('Camp clock');
    expect(titles()).not.toContain('Agents');
    expect(titles()).not.toContain('Archived camps');
    expect(titles()).not.toContain('Danger zone');
  });

  it('lays out every card in one column, with time format and appearance as choice rows', () => {
    render();
    expect(tile('Display name').className).toContain('settings-tile');
    expect(tile('Time format').className).toContain('settings-choice');
    expect(tile('Appearance').className).toContain('settings-choice');
    expect(tile('Time format').className).not.toContain('settings-tile--half');
  });

  it('has the display name with its first and last name inputs and one Update button, and an email card with a read-only input and no button', () => {
    render();
    const name = tile('Display name');
    expect(name.querySelector('input[autocomplete="given-name"]')).not.toBeNull();
    expect(name.querySelector('input[autocomplete="family-name"]')).not.toBeNull();
    expect(buttonIn(name, 'Update')).toBeDefined();
    const email = tile('Email');
    const input = email.querySelector<HTMLInputElement>('input');
    expect(input?.value).toBe('rosa@example.com');
    expect(input?.disabled || input?.readOnly).toBe(true);
    expect(email.querySelector('button')).toBeNull();
  });

  it('has no Update display name button and no dialog', () => {
    render();
    expect(document.body.textContent).not.toContain('Update display name');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('saves the name from the Update button beside the inputs, then the board', async () => {
    render();
    const card = tile('Display name');
    expect(card.querySelector<HTMLInputElement>('input[autocomplete="given-name"]')?.value).toBe('Rosa');
    await act(() => {
      buttonIn(card, 'Update')?.click();

      return Promise.resolve();
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
    await act(() => {
      buttonIn(tile('Display name'), 'Update')?.click();

      return Promise.resolve();
    });
    expect(updateProfile).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Enter your first name.');
  });

  it('shows the time format as a choice with the saved clock selected', () => {
    render();
    const card = tile('Time format');
    expect(card.textContent).toContain('12-hour');
    expect(card.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toContain('12-hour');
  });

  it('has no Save button in the time format card', () => {
    render();
    expect(buttonIn(tile('Time format'), 'Save')).toBeUndefined();
    expect(buttonIn(tile('Time format'), 'Save time format')).toBeUndefined();
  });

  it('shows the appearance as a dropdown, with the saved theme', () => {
    render();
    expect(tile('Appearance').textContent).toContain('System');
  });
});

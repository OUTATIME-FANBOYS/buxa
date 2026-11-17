// @vitest-environment jsdom
import { Dialog as ConfirmDialog } from '@/components/components/export';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { SettingsPage } from '@/components/views/kanban/export';
import { CampClockPanel } from '@/components/components/camp/export';

vi.mock('@/actions/camp', () => ({ updateCampClockAction: async () => ({ status: 'idle' }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => '/camp/settings' }));

const seed = buildSeed();
const CARDS = ['Profile', 'Appearance', 'Agents', 'Your data', 'Keyboard shortcuts'];

describe('the settings grid', () => {
  let root: Root;
  let updateProfile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateProfile = vi.fn();
    h.store = {
      s: { ...seed, ui: { ...seed.ui, agentsEnabled: false, theme: 'system' } }, agents: [], actions: { updateProfile, exportData: () => '{}', setTheme() {}, setAgentsEnabled() {} },
      me: { id: 'u-1', name: 'Rosa Delgado', title: 'Coordinator', email: 'rosa@example.com' }, workspace: null, project: null, projects: [], wsTasks: [],
      kindOf: () => 'open', members: [], myRole: 'owner', readOnly: false, userById: () => undefined, saveStatus: 'saved', sync: 'local',
    };
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  const render = (clock?: ReactNode) => act(() => root.render(
    <UiProvider Dialog={ConfirmDialog}><SettingsPage clock={clock} /></UiProvider>,
  ));
  const cards = () => Array.from(document.querySelectorAll('.settings-grid > section.panel'));
  const appearance = () => cards().find(card => card.querySelector('h2')?.textContent === 'Appearance') as HTMLElement;

  it('puts every setting in one grid of cards, with the page title above it', () => {
    render();
    expect(document.querySelector('h1')?.textContent).toBe('Settings');
    expect(cards().map(card => card.querySelector('h2')?.textContent)).toEqual(CARDS);
    expect(document.querySelector('.settings-page .settings-grid')).not.toBeNull();
  });

  it('puts the camp clock inside the Appearance card, not in a card of its own', () => {
    render(<section className="panel"><h2>Camp clock</h2></section>);
    expect(cards().map(card => card.querySelector('h2')?.textContent)).toEqual(CARDS);
    expect(appearance().textContent).toContain('Camp clock');
  });

  it('keeps the camp clock in the Appearance card with its save action', () => {
    render(<CampClockPanel campId="c-1" clockFormat="24h" canChange />);
    const clock = appearance();
    expect(clock.querySelector('#camp-clock-title')?.textContent).toBe('Camp clock');
    expect(clock.querySelectorAll('section.panel').length).toBe(0);
    expect(clock.querySelector('form')).not.toBeNull();
    const group = clock.querySelector('[role="radiogroup"][aria-label="Clock"]');
    expect(group).not.toBeNull();
    expect(clock.querySelector('fieldset')).toBeNull();
    expect(clock.querySelector<HTMLInputElement>('input[name="clockFormat"]')?.value).toBe('24h');
    const checked = Array.from(group?.querySelectorAll('[role="radio"]') ?? []).find(b => b.getAttribute('aria-checked') === 'true');
    expect(checked?.textContent).toBe('24-hour (09:05)');
    expect(Array.from(clock.querySelectorAll('button')).find(b => b.textContent === 'Save clock')).toBeDefined();
  });

  it('switches the clock format on the segmented control without submitting the form', () => {
    render(<CampClockPanel campId="c-1" clockFormat="24h" canChange />);
    const clock = appearance();
    const twelve = Array.from(clock.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find(b => b.textContent === '12-hour (9:05 AM)');
    act(() => {
      twelve?.click();
    });
    expect(clock.querySelector<HTMLInputElement>('input[name="clockFormat"]')?.value).toBe('12h');
    expect(twelve?.getAttribute('aria-checked')).toBe('true');
    expect(twelve?.getAttribute('type')).toBe('button');
  });

  it('gives the Profile card the id the account menu links to', () => {
    render();
    expect(document.querySelector('.settings-grid > section#profile h2')?.textContent).toBe('Profile');
  });

  it('saves the profile: submitting the form sends the name and role', () => {
    render();
    const input = document.querySelector<HTMLInputElement>('input[maxlength="60"]');
    const form = document.querySelector<HTMLFormElement>('#profile form');
    expect(form).not.toBeNull();
    act(() => {
      form?.querySelector<HTMLButtonElement>('button')?.click();
    });
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Rosa Delgado', title: 'Coordinator' });
    expect(input?.value).toBe('Rosa Delgado');
  });
});

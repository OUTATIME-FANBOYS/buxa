// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AccountMenu } from '@/components/components/camp/export';
import { ROUTES } from '@/config/routes';
import { settle } from '@buxa/domain';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/actions/auth', () => ({ signOut: () => settle(() => undefined) }));
const saveTime = vi.hoisted(() => vi.fn(() => Promise.resolve({ status: 'success', message: 'Time format saved' })));
vi.mock('@/actions/account', () => ({ updateTimeFormatAction: saveTime }));

const store = vi.hoisted(() => ({
  theme: 'dark',
  setTheme: vi.fn(),
}));
vi.mock('@buxa/middleware/providers/providers', () => ({
  useStore: () => ({
    s: { ui: { theme: store.theme } },
    actions: { setTheme: store.setTheme },
  }),
}));

const user = {
  id: 'u-1',
  name: 'Rosa Delgado',
  firstName: 'Rosa',
  lastName: 'Delgado',
  email: 'rosa@example.com',
  clockFormat: '12h' as '12h' | '24h' | null,
};

/** The account menu: a first-name header, a divider, Profile, Appearance and Timezone submenus, Settings, Help, Reports, Sign out. */
describe('the account menu', () => {
  let root: Root;
  beforeEach(() => {
    store.theme = 'dark';
    store.setTheme.mockClear();
    saveTime.mockClear();
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  const openMenu = (u = user) => {
    act(() => root.render(<AccountMenu user={u} />));
    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Account"]')?.click();
    });

    return Array.from(document.querySelectorAll<HTMLElement>('[role=menu] > [role=menuitem]'));
  };
  const menu = () => document.querySelector('[role=menu]')!;
  const item = (label: string) =>
    Array.from(document.querySelectorAll<HTMLElement>('[role=menu] [role=menuitem]')).find(
      el => el.textContent?.trim() === label,
    )!;
  const openSub = (label: string) => {
    act(() => {
      item(label).click();
    });
  };
  const choice = (label: string) =>
    Array.from(document.querySelectorAll<HTMLElement>('[role=menu] [role=menuitemradio]')).find(
      el => el.textContent?.trim() === label,
    );

  it('is headed by the first name, not the full name or the email', () => {
    openMenu();
    expect(document.querySelector('[role=menu] .menu-head')?.textContent).toBe('Rosa');
    expect(menu().textContent).not.toContain('rosa@example.com');
    expect(menu().textContent).not.toContain('Delgado');
  });

  it('puts a divider right under the header, then the options in order, then a divider before Sign out', () => {
    openMenu();
    const children = Array.from(menu().children).map(el => (el.tagName === 'HR' ? '---' : el.textContent?.trim()));
    expect(children).toEqual([
      'Rosa',
      '---',
      'Profile',
      'Appearance',
      'Timezone',
      'Settings',
      'Help',
      'Reports',
      '---',
      'Sign out',
    ]);
  });

  it('keeps the old Dark mode toggle out of the menu: Appearance replaces it', () => {
    openMenu();
    expect(menu().textContent).not.toContain('Dark mode');
    expect(menu().textContent).not.toContain('Light mode');
  });

  it('links Profile to the Profile section of Settings, and the others to their pages', () => {
    openMenu();
    expect(item('Profile').tagName).toBe('A');
    expect(item('Profile').getAttribute('href')).toBe(`${ROUTES.settings}#profile`);
    expect(item('Settings').getAttribute('href')).toBe(ROUTES.settings);
    expect(item('Help').getAttribute('href')).toBe(ROUTES.help);
    expect(item('Reports').getAttribute('href')).toBe(ROUTES.reports);
  });

  it('opens Appearance as a submenu of Light, Dark and System, with a check on the current one', () => {
    openMenu();
    expect(document.querySelector('[role=group][aria-label="Appearance"]')).toBeNull();
    openSub('Appearance');
    expect(item('Appearance').getAttribute('aria-expanded')).toBe('true');
    const labels = ['Light', 'Dark', 'System'].map(l => choice(l));
    expect(labels.every(Boolean)).toBe(true);
    expect(choice('Dark')?.getAttribute('aria-checked')).toBe('true');
    expect(choice('Dark')?.querySelector('.menu-check')).not.toBeNull();
    expect(choice('Light')?.getAttribute('aria-checked')).toBe('false');
    expect(choice('System')?.querySelector('.menu-check')).toBeNull();
  });

  it('chooses an appearance from the submenu through the store, and closes the menu', () => {
    openMenu();
    openSub('Appearance');
    act(() => {
      choice('System')?.click();
    });
    expect(store.setTheme).toHaveBeenCalledWith('system');
    expect(document.querySelector('[role=menu]')).toBeNull();
  });

  it('opens Timezone as a submenu: the local time zone first, then 12-hour and 24-hour, with the saved clock checked', () => {
    openMenu();
    openSub('Timezone');
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(choice(`Local time (${zone})`)?.getAttribute('aria-checked')).toBe('true');
    expect(choice('12-hour clock')?.getAttribute('aria-checked')).toBe('true');
    expect(choice('24-hour clock')?.getAttribute('aria-checked')).toBe('false');
  });

  it('saves a 24-hour choice through the one time format action, and the menu closes', () => {
    openMenu();
    openSub('Timezone');
    act(() => {
      choice('24-hour clock')?.click();
    });
    expect(saveTime).toHaveBeenCalledWith({ clockFormat: '24h' });
    expect(document.querySelector('[role=menu]')).toBeNull();
  });

  it('checks one of the two clock options when the person has not chosen (the browser decides)', () => {
    openMenu({ ...user, clockFormat: null });
    openSub('Timezone');
    const twelve = choice('12-hour clock')?.getAttribute('aria-checked');
    const twentyFour = choice('24-hour clock')?.getAttribute('aria-checked');
    expect([twelve, twentyFour].sort()).toEqual(['false', 'true']);
  });
});

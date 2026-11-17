// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AccountMenu } from '@/components/components/camp/export';
import { ROUTES } from '@/config/routes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/actions/auth', () => ({ signOut: async () => undefined }));
vi.mock('@buxa/server/composers/auth/signOut', () => ({ signOut: async () => undefined }));

const user = { id: 'u-1', name: 'Rosa Delgado', email: 'rosa@example.com' };

describe('the account menu', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  const openMenu = () => {
    act(() => root.render(<AccountMenu user={user} />));
    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Account"]')?.click();
    });

    return Array.from(document.querySelectorAll<HTMLElement>('[role=menu] [role=menuitem]'));
  };

  it('is headed by the user’s name, not their email', () => {
    openMenu();

    const head = document.querySelector('[role=menu] .menu-head');
    expect(head?.textContent).toBe('Rosa Delgado');
    expect(document.querySelector('[role=menu]')?.textContent).not.toContain('rosa@example.com');
  });

  it('lists Profile, Settings, Help, Reports, the theme toggle, then Sign out', () => {
    const items = openMenu();
    expect(items.map(item => item.textContent)).toEqual(['Profile', 'Settings', 'Help', 'Reports', 'Dark mode', 'Sign out']);
  });

  it('links Profile to the Profile section of Settings, and the others to their pages', () => {
    const items = openMenu();
    const href = (label: string) => items.find(item => item.textContent === label)?.getAttribute('href');
    expect(items.find(item => item.textContent === 'Profile')?.tagName).toBe('A');
    expect(href('Profile')).toBe(`${ROUTES.settings}#profile`);
    expect(href('Settings')).toBe(ROUTES.settings);
    expect(ROUTES.settings).toBe('/camp/settings');
    expect(href('Help')).toBe(ROUTES.help);
    expect(href('Reports')).toBe(ROUTES.reports);
  });
});

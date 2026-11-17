// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { User } from '@buxa/contracts';
import { AccountMenu } from '@/components/components/camp/export';
import { ROUTES } from '@/config/routes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/actions/auth', () => ({ signOut: async () => undefined }));
vi.mock('@buxa/server/composers/auth/signOut', () => ({ signOut: async () => undefined }));

const user = { id: 'u-1', name: 'Rosa Delgado', email: 'rosa@example.com' } as unknown as User;

describe('the account menu', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('lists Settings as a link to the settings page, after the account line', () => {
    act(() => root.render(<AccountMenu user={user} />));
    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Account"]')?.click();
    });
    const items = Array.from(document.querySelectorAll<HTMLElement>('[role=menu] [role=menuitem]'));
    const settings = items.find(item => item.textContent?.includes('Settings'));
    expect(settings?.tagName).toBe('A');
    expect(settings?.getAttribute('href')).toBe(ROUTES.settings);
    expect(ROUTES.settings).toBe('/camp/settings');
    expect(items.indexOf(settings!)).toBe(1);
  });
});

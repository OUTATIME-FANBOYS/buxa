// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AccountMenu } from '@/components/components/camp';
import { HomeHeader } from '@/components/components/kanban/home';

vi.mock('@/actions/auth', () => ({ signOut: () => Promise.resolve(undefined) }));
vi.mock('@/actions/account', () => ({
  updateTimeFormatAction: () => Promise.resolve({ status: 'success', message: '' }),
}));
vi.mock('@buxa/middleware/providers/providers', () => ({
  useStore: () => ({ s: { ui: { theme: 'light' } }, actions: { setTheme: () => undefined } }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The account menu is given the signed-in person from the session: its header shows the first name, never the email. */
describe('AccountMenu', () => {
  let root: Root;

  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('shows the first name in the menu header and the saved name on the avatar', () => {
    act(() =>
      root.render(
        <AccountMenu
          hasCamp
          user={{
            id: 'u-1',
            name: 'Test User',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            clockFormat: null,
          }}
        />,
      ),
    );
    expect(document.querySelector('[aria-label="Test User"]')).not.toBeNull();

    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Account"]')?.click();
    });
    expect(document.querySelector('.menu-head')?.textContent).toBe('Test');
    expect(document.body.textContent).not.toContain('test@example.com');
  });
});

describe('HomeHeader greeting', () => {
  it('greets the person by the first name', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<HomeHeader firstName="Test" camp={null} />));
    expect(container.querySelector('h1')?.textContent).toMatch(/, Test$/);
    act(() => root.unmount());
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AccountMenu } from '@/components/components/camp/export';
import { HomeHeader } from '@/components/components/kanban/home/export';

vi.mock('@/actions/auth', () => ({ signOut: () => Promise.resolve(undefined) }));
vi.mock('@buxa/middleware/hooks/hooks', () => ({ useDarkMode: () => ({ dark: false, toggle: () => undefined }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The account menu is given the signed-in person from the session, so the name it shows is the saved account name. */
describe('AccountMenu', () => {
  let root: Root;

  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('shows the saved account name in the menu header and on the avatar', () => {
    act(() => root.render(<AccountMenu user={{ id: 'u-1', name: 'Test User', email: 'test@example.com' }} />));
    expect(document.querySelector('[aria-label="Test User"]')).not.toBeNull();

    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Account"]')?.click();
    });
    expect(document.querySelector('.menu-head')?.textContent).toBe('Test User');
    expect(document.body.textContent).not.toContain('testuser1');
  });
});

describe('HomeHeader greeting', () => {
  it('greets the person by the first word of the saved name', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<HomeHeader firstName="Test" camp={null} />));
    expect(container.querySelector('h1')?.textContent).toMatch(/, Test$/);
    act(() => root.unmount());
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Membership } from '@buxa/contracts';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ConfirmDialog } from '@/components/components';
import { CampSwitcher } from '@/components/components/camp';

const h = vi.hoisted(() => ({
  select: vi.fn(() => Promise.resolve(undefined)),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock('@/actions/camp', () => ({ selectCampAction: h.select }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const camp = (orgId: string, name: string, role: string) =>
  ({ orgId, name, role, slug: orgId }) as unknown as Membership;
const CEDAR_OWNER = camp('o-cedar', 'Camp Cedar', 'owner');
const BIRCH = camp('o-birch', 'Camp Birchwood', 'owner');
const CEDAR_ADMIN = camp('o-cedar', 'Camp Cedar', 'admin');
const CEDAR_VIEWER = camp('o-cedar', 'Camp Cedar', 'viewer');

describe('CampSwitcher rows', () => {
  let root: Root;
  beforeEach(() => {
    h.select.mockClear();
    h.push.mockClear();
    h.refresh.mockClear();
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  const render = (camps: Membership[], current: Membership) =>
    act(() =>
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <CampSwitcher camps={camps} current={current} />
        </UiProvider>,
      ),
    );
  const open = () =>
    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Switch camp"]')?.click();
    });
  const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  const rowName = (text: string) => rows().find(i => i.textContent?.trim() === text);
  /** Buttons in the open menu that are not menu items. A row with an icon button would show one here. */
  const nonRowButtons = () =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menu"] button')).filter(
      b => b.getAttribute('role') !== 'menuitem',
    );

  it.each([
    ['owner', [CEDAR_OWNER, BIRCH]],
    ['admin', [CEDAR_ADMIN]],
    ['viewer', [CEDAR_VIEWER]],
  ])('a %s sees each camp row with only its name, and no rename, archive or delete buttons', (_role, camps) => {
    render(camps, camps[0]);
    open();

    // The footer's "New camp…" row is a menu item too; the camp rows are the rest.
    expect(rows().filter(r => r.textContent?.trim() !== 'New camp…').length).toBe(camps.length);
    expect(document.querySelectorAll('[aria-label^="Rename "]').length).toBe(0);
    expect(document.querySelectorAll('[aria-label^="Archive "]').length).toBe(0);
    expect(document.querySelectorAll('[aria-label^="Delete "]').length).toBe(0);
    expect(nonRowButtons()).toEqual([]);
  });

  it('a row name still switches camp', async () => {
    render([CEDAR_OWNER, BIRCH], BIRCH);
    open();
    await act(() => {
      rowName('Camp Cedar')?.click();

      return Promise.resolve();
    });
    expect(h.select).toHaveBeenCalledWith('o-cedar');
    expect(h.push).toHaveBeenCalledWith('/camp');
  });

  it('keeps the New camp item in the footer', () => {
    render([CEDAR_OWNER], CEDAR_OWNER);
    open();
    expect(rows().map(r => r.textContent?.trim())).toContain('New camp…');
  });
});

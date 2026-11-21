// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Membership } from '@buxa/contracts';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Dialog as ConfirmDialog } from '@/components/components';
import { CampSwitcher } from '@/components/components/camp';

const h = vi.hoisted(() => ({
  select: vi.fn(() => Promise.resolve(undefined)),
  rename: vi.fn(() => Promise.resolve({ status: 'idle' })),
  archive: vi.fn(() => Promise.resolve({ ok: true })),
  deleteCamp: vi.fn(() => Promise.resolve({ ok: true })),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock('@/actions/camp', () => ({
  selectCampAction: h.select,
  renameCampAction: h.rename,
  archiveCamp: h.archive,
  deleteCamp: h.deleteCamp,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const camp = (orgId: string, name: string, role: string) =>
  ({ orgId, name, role, slug: orgId }) as unknown as Membership;
const CEDAR_OWNER = camp('o-cedar', 'Camp Cedar', 'owner');
const BIRCH = camp('o-birch', 'Camp Birchwood', 'owner');
const CEDAR_ADMIN = camp('o-cedar', 'Camp Cedar', 'admin');
const CEDAR_VIEWER = camp('o-cedar', 'Camp Cedar', 'viewer');

describe('CampSwitcher row buttons', () => {
  let root: Root;
  beforeEach(() => {
    h.select.mockClear();
    h.rename.mockClear();
    h.archive.mockClear();
    h.deleteCamp.mockClear();
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
  const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const dialogTitle = () => document.querySelector('[role="dialog"]')?.textContent ?? '';
  const rowName = (text: string) =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(i => i.textContent?.trim() === text);

  it('the rename, archive and delete buttons do not switch camp', async () => {
    render([CEDAR_OWNER, BIRCH], BIRCH);
    open();

    act(() => button('Rename Camp Cedar')?.click());
    expect(dialogTitle()).toContain('Rename camp');
    expect(h.select).not.toHaveBeenCalled();

    open();
    act(() => button('Archive Camp Cedar')?.click());
    expect(dialogTitle()).toContain('Archive camp?');
    await act(() => {
      Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
        .find(b => b.textContent?.trim() === 'Archive camp')
        ?.click();

      return Promise.resolve();
    });
    expect(h.archive).toHaveBeenCalledWith({ orgId: 'o-cedar' });
    expect(h.select).not.toHaveBeenCalled();

    open();
    act(() => button('Delete Camp Cedar')?.click());
    expect(dialogTitle()).toContain('Are you sure you want to delete Camp Cedar?');
    expect(h.select).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('the row name still switches camp', async () => {
    render([CEDAR_OWNER, BIRCH], BIRCH);
    open();
    await act(() => {
      rowName('Camp Cedar')?.click();

      return Promise.resolve();
    });
    expect(h.select).toHaveBeenCalledWith('o-cedar');
  });

  it('hides Delete for an admin, who still sees Rename and Archive', () => {
    render([CEDAR_ADMIN], CEDAR_ADMIN);
    open();

    expect(button('Rename Camp Cedar')).not.toBeNull();
    expect(button('Archive Camp Cedar')).not.toBeNull();
    expect(document.querySelector('[aria-label^="Delete "]')).toBeNull();
  });

  it('shows no row buttons to a viewer', () => {
    render([CEDAR_VIEWER], CEDAR_VIEWER);
    open();

    expect(document.querySelector('button[aria-label^="Rename "]')).toBeNull();
    expect(document.querySelector('button[aria-label^="Archive "]')).toBeNull();
    expect(document.querySelector('button[aria-label^="Delete "]')).toBeNull();
  });
});

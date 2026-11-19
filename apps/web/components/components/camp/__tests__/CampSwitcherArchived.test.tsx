// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Membership } from '@buxa/contracts';
import { CampSwitcher } from '@/components/components/camp';

const h = vi.hoisted(() => ({ select: vi.fn(async () => undefined), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock('@/actions/camp', () => ({ selectCampAction: h.select }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const live = { orgId: 'o-1', name: 'Camp Birchwood', role: 'owner', slug: 'birchwood' } as unknown as Membership;
const CEDAR = { id: 'o-9', name: 'Camp Cedar', archivedAt: '2026-10-02T09:00:00.000Z', role: 'admin' as const };

describe('CampSwitcher with archived camps', () => {
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

  const open = () =>
    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Switch camp"]')?.click();
    });
  const labels = () => Array.from(document.querySelectorAll('[role="menuitem"]')).map(i => i.textContent?.trim());
  const item = (text: string) =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(i => i.textContent?.trim() === text);

  it('ends the menu with one "Show archived" item, after "New camp…", and lists no archived camps inline', () => {
    act(() => root.render(<CampSwitcher camps={[live]} current={live} archivedCamps={[CEDAR]} />));
    open();
    const items = labels();
    expect(items.filter(t => t === 'Show archived')).toHaveLength(1);
    expect(items.indexOf('Show archived')).toBe(items.length - 1);
    expect(items.indexOf('New camp…')).toBeLessThan(items.indexOf('Show archived'));
    expect(items).not.toContain('Camp Cedar');
    expect(items).not.toContain('Archived');
  });

  it('outlines "New camp…" in the ok green, and its text sits at the left edge of the row', () => {
    act(() => root.render(<CampSwitcher camps={[live]} current={live} archivedCamps={[]} />));
    open();
    const row = item('New camp…');
    expect(row?.className).toContain('border-[var(--ok)]!');
    expect(row?.className).toContain('pl-0!');
    expect(item('Camp Birchwood')?.className).not.toContain('border-[var(--ok)]!');
  });

  it('"Show archived" opens the archived list, which selects a camp the same way as a live camp', async () => {
    act(() => root.render(<CampSwitcher camps={[live]} current={live} archivedCamps={[CEDAR]} />));
    open();
    act(() => {
      item('Show archived')?.click();
    });
    const cedar = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).find(
      i => i.textContent?.trim() === 'Camp Cedar',
    );
    expect(cedar).toBeDefined();
    await act(async () => {
      cedar?.click();
    });
    expect(h.select).toHaveBeenCalledWith('o-9');
  });

  it('shows no "Show archived" item when there are no archived camps', () => {
    act(() => root.render(<CampSwitcher camps={[live]} current={live} />));
    open();
    expect(labels()).not.toContain('Show archived');
    expect(labels()).not.toContain('Archived');
  });
});

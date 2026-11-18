// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Membership } from '@buxa/contracts';
import { CampSwitcher } from '@/components/components/camp/export';

const h = vi.hoisted(() => ({ select: vi.fn(async () => undefined), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock('@/actions/camp', () => ({ selectCampAction: h.select }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const live = { orgId: 'o-1', name: 'Camp Birchwood', role: 'owner', slug: 'birchwood' } as unknown as Membership;
const CEDAR = { id: 'o-9', name: 'Camp Cedar', archivedAt: '2026-10-02T09:00:00.000Z' };

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

  it('lists archived camps under an "Archived" label, after the live camps', () => {
    act(() => root.render(<CampSwitcher camps={[live]} current={live} archivedCamps={[CEDAR]} />));
    open();
    const items = labels();
    const label = items.indexOf('Archived');
    expect(label).toBeGreaterThan(items.indexOf('Camp Birchwood'));
    expect(items[label + 1]).toBe('Camp Cedar');
    expect(document.querySelector('[role="menuitem"][disabled]')?.textContent?.trim()).toBe('Archived');
  });

  it('opens an archived camp by selecting it, the same way as a live camp', async () => {
    act(() => root.render(<CampSwitcher camps={[live]} current={live} archivedCamps={[CEDAR]} />));
    open();
    const cedar = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
      i => i.textContent?.trim() === 'Camp Cedar',
    );
    await act(async () => {
      cedar?.click();
    });
    expect(h.select).toHaveBeenCalledWith('o-9');
  });

  it('shows no Archived label when there are no archived camps', () => {
    act(() => root.render(<CampSwitcher camps={[live]} current={live} />));
    open();
    expect(labels()).not.toContain('Archived');
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Membership } from '@buxa/contracts';
import { CampSwitcher } from '@/components/components/camp';

const h = vi.hoisted(() => ({ select: vi.fn(() => Promise.resolve(undefined)), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock('@/actions/camp', () => ({ selectCampAction: h.select }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RECENT_KEY = 'buxa.recentCamps';
const camp = (orgId: string, name: string) => ({ orgId, name, role: 'owner', slug: orgId }) as unknown as Membership;
const BIRCH = camp('o-birch', 'Camp Birchwood');
const ALDER = camp('o-alder', 'Camp Alder');
const CEDAR = camp('o-cedar', 'Camp Cedar');
const camps = [BIRCH, CEDAR, ALDER];

// jsdom here has no usable localStorage, so the tests use a small in-memory one.
const memory = () => {
  const data = new Map<string, string>();

  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
};

describe('CampSwitcher search and recent camp', () => {
  let root: Root;
  let store: ReturnType<typeof memory>;
  beforeEach(() => {
    h.select.mockClear();
    h.push.mockClear();
    h.refresh.mockClear();
    store = memory();
    vi.stubGlobal('localStorage', store);
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const open = () =>
    act(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Switch camp"]')?.click();
    });
  const search = () => document.querySelector<HTMLInputElement>('input[type="search"]');
  const type = (text: string) =>
    act(() => {
      const input = search();
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(input, text);
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
  const camps_ = () =>
    Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"]'))
      .map(i => i.textContent?.trim())
      .filter(t => !['New camp…', 'Show archived', 'No matching camps'].includes(t ?? ''));

  it('filters the camp list by name, case-insensitively, and keeps the search field in the menu', () => {
    act(() => root.render(<CampSwitcher camps={camps} current={BIRCH} />));
    open();
    expect(search()).not.toBeNull();
    type('CED');
    expect(camps_()).toEqual(['Camp Cedar']);
    expect(search()?.value).toBe('CED');
    expect(document.activeElement).toBe(search());
  });

  it('says so when no camp matches', () => {
    act(() => root.render(<CampSwitcher camps={camps} current={BIRCH} />));
    open();
    type('zzz');
    expect(camps_()).toEqual([]);
    expect(document.body.textContent).toContain('No matching camps');
  });

  it('clears the search when the menu closes', () => {
    act(() => root.render(<CampSwitcher camps={camps} current={BIRCH} />));
    open();
    type('cedar');
    open();
    open();
    expect(search()?.value).toBe('');
    expect(camps_()).toHaveLength(3);
  });

  it('lists the camp last opened first, and the rest by name', () => {
    store.setItem(RECENT_KEY, 'o-cedar');
    act(() => root.render(<CampSwitcher camps={camps} current={BIRCH} />));
    open();
    expect(camps_()).toEqual(['Camp Cedar', 'Camp Alder', 'Camp Birchwood']);
  });

  it('lists at most 8 recent camps when nothing is searched, and a search still finds the rest', () => {
    const many = Array.from({ length: 10 }, (_, i) => camp(`o-${i}`, `Camp ${String(i).padStart(2, '0')}`));
    act(() => root.render(<CampSwitcher camps={many} current={many[0]} />));
    open();
    expect(camps_()).toHaveLength(8);
    type('Camp 09');
    expect(camps_()).toEqual(['Camp 09']);
  });

  it('remembers a camp the person opens, so it leads the menu next time', async () => {
    act(() => root.render(<CampSwitcher camps={camps} current={BIRCH} />));
    open();
    const cedar = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
      i => i.textContent?.trim() === 'Camp Cedar',
    );
    await act(() => {
      cedar?.click();

      return Promise.resolve();
    });
    expect(h.select).toHaveBeenCalledWith('o-cedar');
    expect(store.getItem(RECENT_KEY)).toBe(JSON.stringify(['o-cedar']));
  });

  it('keeps the menu working when storage is blocked', async () => {
    vi.spyOn(store, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(store, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    act(() => root.render(<CampSwitcher camps={camps} current={BIRCH} />));
    open();
    expect(camps_()).toEqual(['Camp Alder', 'Camp Birchwood', 'Camp Cedar']);
    type('alder');
    expect(camps_()).toEqual(['Camp Alder']);
    const alder = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
      i => i.textContent?.trim() === 'Camp Alder',
    );
    await act(() => {
      alder?.click();

      return Promise.resolve();
    });
    expect(h.select).toHaveBeenCalledWith('o-alder');
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useDarkMode } from '../useDarkMode';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const store = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } });

type Api = ReturnType<typeof useDarkMode>;
let api: Api | undefined;
function Probe() { api = useDarkMode(); return null; }

describe('useDarkMode', () => {
  let root: Root;
  beforeEach(() => {
    api = undefined;
    document.documentElement.dataset.theme = 'light';
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => root.render(<Probe />));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; delete document.documentElement.dataset.theme; store.clear(); });

  it('reads the page’s theme after mount and toggles it', () => {
    expect(api!.dark).toBe(false);
    act(() => api!.toggle());
    expect(api!.dark).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

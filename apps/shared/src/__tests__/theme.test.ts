// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY } from '../config/theme';
import { isDark, setTheme } from '../theme';

// Node 22+ ships its own localStorage global that shadows jsdom's, so the store is stubbed for these tests.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  clear: () => store.clear(),
});

describe('theme', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    store.clear();
  });
  it('setTheme sets the document theme and stores the choice under the shared key', () => {
    setTheme(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('"dark"');
    setTheme(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('"light"');
  });
  it('isDark reads the document theme', () => {
    setTheme(true);
    expect(isDark()).toBe(true);
    setTheme(false);
    expect(isDark()).toBe(false);
  });
});

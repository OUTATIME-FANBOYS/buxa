'use client';

import { useEffect, useState } from 'react';
import type { ThemePref } from '@buxa/shared';
import { THEME_KEY } from '@buxa/shared/config/theme';

const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

const isDark = (theme: ThemePref) => theme === 'dark' || (theme === 'system' && prefersDark());

function readTheme(): ThemePref {
  try {
    const raw = localStorage.getItem(THEME_KEY);

    return raw ? (JSON.parse(raw) as ThemePref) : 'system';
  } catch {
    return 'system';
  }
}

/**
 * The device's light, dark or system choice for the camp area. It reads and writes the same key as the kanban store and
 * theme-init.js, so the page keeps its theme without the kanban store, which exists only on the work pages.
 */
export function useAppearance(): [ThemePref, (theme: ThemePref) => void] {
  const [theme, setTheme] = useState<ThemePref>('system');
  useEffect(() => setTheme(readTheme()), []);

  const choose = (next: ThemePref) => {
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify(next));
    } catch {
      // Storage can be blocked; the choice still applies for this page.
    }
    document.documentElement.dataset.theme = isDark(next) ? 'dark' : 'light';
  };

  return [theme, choose];
}

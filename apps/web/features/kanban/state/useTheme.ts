import { useEffect } from 'react';
import type { ThemePref } from '../types';

/** Mirrors the theme preference onto `<html data-theme>`, following the system setting when the preference is "system". */
export function useTheme(theme: ThemePref) {
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

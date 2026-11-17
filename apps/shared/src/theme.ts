import { THEME_EVENT, THEME_KEY } from './config/theme';

/**
 * Light/dark. Shares the key the original app and index.html read, so the choice carries across both.
 * Tells the kanban store (if it is mounted) so its own copy of the choice never overwrites this one.
 */
export function setTheme(dark: boolean): void {
  const value = dark ? 'dark' : 'light';
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(value));
  } catch { /* storage may be blocked */ }
  document.documentElement.dataset.theme = value;
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: value }));
}
export const isDark = (): boolean => document.documentElement.dataset.theme === 'dark';

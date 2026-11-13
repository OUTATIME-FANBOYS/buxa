/** Light/dark. Shares the key the original app and index.html read, so the choice carries across both. */
export function setTheme(dark: boolean): void {
  try { localStorage.setItem('buxa.theme', JSON.stringify(dark ? 'dark' : 'light')); } catch { /* storage may be blocked */ }
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
export const isDark = (): boolean => document.documentElement.dataset.theme === 'dark';

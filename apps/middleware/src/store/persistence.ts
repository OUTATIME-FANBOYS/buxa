import { LEGACY_THEME_KEY, THEME_KEY } from '@buxa/shared/config/theme';
import type { AppState, ThemePref } from '@buxa/shared';
import { buildDemo } from '@buxa/shared';
import { normalize } from '@buxa/shared';

const KEY = 'buxa.state.v1';
const LEGACY_KEY = 'tessera.state.v1'; // the key from before the app was renamed; read so saved data is not lost

export type SaveStatus = 'saved' | 'saving' | 'error';

/** The theme the person chose, as saved by the account menu or the settings page. Null when nothing valid is stored. */
export function savedTheme(): ThemePref | null {
  try {
    const raw = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY);
    const value: unknown = raw === null ? null : JSON.parse(raw);

    return value === 'system' || value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** The saved state, or a fresh demo when nothing usable is stored. The theme always comes from the saved choice, when there is one. */
export function loadState(): AppState {
  const theme = savedTheme();
  let state: AppState | null = null;
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s.version === 1) {
        state = normalize(s);
      }
    }
  } catch {
    /* fall through to seed */
  }
  const base = state ?? buildDemo();

  return theme ? { ...base, ui: { ...base.ui, theme } } : base;
}

/** Persistence adapter. One implementation today (localStorage); an API client would satisfy the same call. */
export const storage = {
  save(state: AppState) {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(THEME_KEY, JSON.stringify(state.ui.theme));
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(LEGACY_THEME_KEY);
  },
};

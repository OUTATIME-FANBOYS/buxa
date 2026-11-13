import type { AppState } from '../types';
import { buildDemo } from '../lib/demo';
import { normalize } from './normalize';

const KEY = 'buxa.state.v1';
const LEGACY_KEY = 'tessera.state.v1'; // the app's previous name; read once so nobody loses their data

export type SaveStatus = 'saved' | 'saving' | 'error';

/** The saved state, or a fresh demo when nothing usable is stored. */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (raw) { const s = JSON.parse(raw) as AppState; if (s.version === 1) return normalize(s); }
  } catch { /* fall through to seed */ }
  return buildDemo();
}

/** Persistence adapter. One implementation today (localStorage); an API client would satisfy the same call. */
export const storage = {
  save(state: AppState) {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem('buxa.theme', JSON.stringify(state.ui.theme));
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem('tessera.theme');
  },
};

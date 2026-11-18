import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY } from '@buxa/shared/config/theme';
import { buildSeed } from '@buxa/shared';
import { loadState, storage } from '../persistence';
import { requirePresent } from '@buxa/domain';

// Node has its own localStorage global; the store here is an in-memory stub for every test.
const store = new Map<string, string>();
const stub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
};

describe('state persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', stub); store.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads the saved state, normalised, when the current version is stored', () => {
    const seed = buildSeed();
    store.set('buxa.state.v1', JSON.stringify(seed));
    expect(loadState().tasks.map((t) => t.id)).toEqual(seed.tasks.map((t) => t.id));
  });
  it('reads the state saved under the app’s previous name', () => {
    store.set('tessera.state.v1', JSON.stringify(buildSeed()));
    expect(loadState().workspaces.length).toBeGreaterThan(0);
  });
  it('falls back to the demo for unreadable or unknown-version data', () => {
    store.set('buxa.state.v1', '{not json');
    expect(loadState().session.userId).toBeNull();
    store.set('buxa.state.v1', JSON.stringify({ ...buildSeed(), version: 99 }));
    expect(loadState().runs.length).toBeGreaterThan(0);
  });
  it('opens on the saved theme, not the theme inside the stored state', () => {
    // A camp page saved "light" while the stored kanban state still says "system": visiting Home must not switch the theme.
    store.set('buxa.state.v1', JSON.stringify({ ...buildSeed(), ui: { ...buildSeed().ui, theme: 'system' } }));
    store.set(THEME_KEY, JSON.stringify('light'));
    expect(loadState().ui.theme).toBe('light');
  });
  it('falls back to the stored state’s theme when no theme was saved', () => {
    store.set('buxa.state.v1', JSON.stringify({ ...buildSeed(), ui: { ...buildSeed().ui, theme: 'dark' } }));
    expect(loadState().ui.theme).toBe('dark');
  });
  it('ignores a saved theme it does not recognise', () => {
    store.set(THEME_KEY, '"purple"');
    expect(loadState().ui.theme).toBe(buildSeed().ui.theme);
  });
  it('saves the state and the theme, and clears the previous name’s keys', () => {
    store.set('tessera.state.v1', '{}');
    const seed = buildSeed();
    storage.save(seed);
    const saved: unknown = JSON.parse(requirePresent(store.get('buxa.state.v1'), "store.get('buxa.state.v1')"));
    expect(saved).toMatchObject({ version: 1 });
    expect(JSON.parse(requirePresent(store.get(THEME_KEY), 'store.get(THEME_KEY)'))).toBe(seed.ui.theme);
    expect(store.has('tessera.state.v1')).toBe(false);
  });
});

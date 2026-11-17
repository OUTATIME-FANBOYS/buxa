/** The one key under which "the install hint was dismissed" is remembered in this browser. */
export const INSTALL_HINT_KEY = 'buxa.installHintDismissed';

/** The part of Web Storage this module uses. Real `localStorage` satisfies it; tests pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The browser's localStorage, or null when the browser refuses access (private windows, blocked site data). Reading the property
 * itself can throw in those cases, so the access is inside the try.
 */
export function browserStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** True when the store says the hint was dismissed. A store that throws counts as "not dismissed": the hint shows again, which is harmless. */
export function readDismissed(store: KeyValueStore | null, key: string = INSTALL_HINT_KEY): boolean {
  if (!store) {
    return false;
  }
  try {
    return store.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Remembers the dismissal. Returns false when the store refused, so the caller can keep the dismissal for this page view only. */
export function writeDismissed(store: KeyValueStore | null, key: string = INSTALL_HINT_KEY): boolean {
  if (!store) {
    return false;
  }
  try {
    store.setItem(key, '1');

    return true;
  } catch {
    return false;
  }
}

import { describe, expect, it } from 'vitest';
import { INSTALL_HINT_KEY, readDismissed, writeDismissed, type KeyValueStore } from '../dismissal';

/** A store that keeps values in a Map, like localStorage does for strings. */
function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
}

/** A store that throws on every access, as a private window or blocked site data does. */
const throwingStore: KeyValueStore = {
  getItem: () => { throw new DOMException('blocked', 'SecurityError'); },
  setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); },
};

describe('install hint dismissal', () => {
  it('is not dismissed until it is written, then it is', () => {
    const store = memoryStore();
    expect(readDismissed(store)).toBe(false);
    expect(writeDismissed(store)).toBe(true);
    expect(store.data.get(INSTALL_HINT_KEY)).toBe('1');
    expect(readDismissed(store)).toBe(true);
  });

  it('reads only its own key', () => {
    const store = memoryStore();
    store.data.set('something.else', '1');
    expect(readDismissed(store)).toBe(false);
  });

  it('a store that throws reads as not dismissed, and the write reports failure instead of throwing', () => {
    expect(readDismissed(throwingStore)).toBe(false);
    expect(writeDismissed(throwingStore)).toBe(false);
  });

  it('no storage at all (browser refuses localStorage) is treated the same way', () => {
    expect(readDismissed(null)).toBe(false);
    expect(writeDismissed(null)).toBe(false);
  });
});

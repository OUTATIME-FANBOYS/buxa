import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoUsers, enterDemo } from './demoEntry';
import { loadState, storage } from './persistence';

/** A minimal in-memory localStorage, enough for the demo store. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('demoUsers', () => {
  it('offers up to three demo accounts, by name', () => {
    const users = demoUsers();
    expect(users.length).toBeGreaterThan(0);
    expect(users.length).toBeLessThanOrEqual(3);
    expect(users.every(u => u.id && u.name)).toBe(true);
  });
});

describe('enterDemo', () => {
  it('makes the chosen demo account the signed-in one for the task pages, and keeps the saved data', () => {
    const seeded = loadState();
    storage.save(seeded); // the demo seed is built fresh each time, so save one before comparing
    const [first] = demoUsers();
    enterDemo(first.id);
    const after = loadState();
    expect(after.session.userId).toBe(first.id);
    expect(after.tasks).toEqual(seeded.tasks);
    expect(after.projects).toEqual(seeded.projects);
  });

  it('writes the session where the task store reads it on load', () => {
    const [first] = demoUsers();
    enterDemo(first.id);
    expect(JSON.parse(localStorage.getItem('buxa.state.v1') ?? '{}').session).toEqual({ userId: first.id });
  });
});

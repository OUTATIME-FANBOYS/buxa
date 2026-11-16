import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed, WORKSPACE } from '../seed';

// The seed reads the clock for its dates, so it is pinned to one day: the same day must give the same data.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2027-03-01T12:00:00Z'));
});
afterEach(() => { vi.useRealTimers(); });

describe('browser demo seed', () => {
  it('gives the same data every time it is built on the same day', () => {
    expect(JSON.stringify(buildSeed())).toBe(JSON.stringify(buildSeed()));
  });

  it('holds the camp workspace only', () => {
    const s = buildSeed();
    expect(s.workspaces.map(w => w.name)).toEqual(['Camp Birchwood']);
    expect(s.projects.every(p => p.workspaceId === WORKSPACE.camp)).toBe(true);
  });

  it('has camp staff-operations tasks and no tickets or other companies', () => {
    const s = buildSeed();
    expect(s.tasks.length).toBeGreaterThan(0);
    expect(JSON.stringify(s)).not.toMatch(/ticket|northwind|acme|priya|personal/i);
  });

  it('gives every task a project and column that exist', () => {
    const s = buildSeed();
    const columnIds = new Set(s.projects.flatMap(p => p.columns.map(c => c.id)));
    expect(s.tasks.every(t => s.projects.some(p => p.id === t.projectId) && columnIds.has(t.columnId))).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Filter, Task } from '../types';
import { PRIORITIES, PRIORITY_LABEL, PRIORITY_RANK, dueInfo, emptyFilter, fmtSize, isFilterActive, matchesFilter, sortTasks, subtaskProgress, uid } from '../tasks';

const task = (over: Partial<Task> = {}): Task => ({
  id: 't', projectId: 'p', columnId: 'c', title: 'Write the form', description: 'Family questions', priority: 'medium',
  tags: ['family'], subtasks: [{ id: 's1', title: 'a', done: true }, { id: 's2', title: 'b', done: false }], comments: [], attachments: [],
  history: [], archived: false, createdAt: '2027-07-01T00:00:00.000Z', createdBy: 'u', ...over,
});

describe('task priorities', () => {
  it('lists the priorities low to critical with labels and ranks', () => {
    expect(PRIORITIES).toEqual(['low', 'medium', 'high', 'critical']);
    expect(PRIORITY_LABEL.critical).toBe('Critical');
    expect(PRIORITY_RANK.critical).toBeGreaterThan(PRIORITY_RANK.low);
  });
});

describe('dueInfo', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2027, 6, 10, 12));
  });
  afterEach(() => vi.useRealTimers());
  it('has no info without a due date', () => {
    expect(dueInfo(undefined, 'open')).toBeNull();
  });
  it('marks overdue, today, tomorrow and later dates', () => {
    expect(dueInfo('2027-07-09', 'open')).toMatchObject({ label: 'Yesterday', tone: 'overdue' });
    expect(dueInfo('2027-07-07', 'open')).toMatchObject({ label: '3d overdue', tone: 'overdue' });
    expect(dueInfo('2027-07-10', 'open')).toMatchObject({ label: 'Today', tone: 'soon' });
    expect(dueInfo('2027-07-11', 'active')).toMatchObject({ label: 'Tomorrow', tone: 'soon' });
    expect(dueInfo('2027-07-20', 'open')?.tone).toBe('normal');
  });
  it('shows finished tasks as done whatever the date', () => {
    expect(dueInfo('2027-07-01', 'done')?.tone).toBe('done');
  });
});

describe('matchesFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2027, 6, 10, 12));
  });
  afterEach(() => vi.useRealTimers());
  const f = (over: Partial<Filter>): Filter => ({ ...emptyFilter, ...over });
  it('matches the text query against title and description, case-insensitively', () => {
    expect(matchesFilter(task(), f({ q: 'FORM' }), 'open')).toBe(true);
    expect(matchesFilter(task(), f({ q: 'budget' }), 'open')).toBe(false);
  });
  it('filters by priority, column, assignee and tag', () => {
    expect(matchesFilter(task(), f({ priorities: ['high'] }), 'open')).toBe(false);
    expect(matchesFilter(task({ columnId: 'x' }), f({ columns: ['c'] }), 'open')).toBe(false);
    expect(matchesFilter(task({ assigneeId: undefined }), f({ assignees: ['none'] }), 'open')).toBe(true);
    expect(matchesFilter(task(), f({ tags: ['work', 'family'] }), 'open')).toBe(true);
  });
  it('applies the due filters, leaving finished work out of overdue', () => {
    expect(matchesFilter(task({ due: '2027-07-07' }), f({ due: 'overdue' }), 'open')).toBe(true);
    expect(matchesFilter(task({ due: '2027-07-07' }), f({ due: 'overdue' }), 'done')).toBe(false);
    expect(matchesFilter(task({ due: '2027-07-10' }), f({ due: 'today' }), 'open')).toBe(true);
    expect(matchesFilter(task({ due: '2027-07-15' }), f({ due: 'week' }), 'open')).toBe(true);
    expect(matchesFilter(task({ due: '2027-08-15' }), f({ due: 'week' }), 'open')).toBe(false);
    expect(matchesFilter(task({ due: '2027-07-15' }), f({ due: 'none' }), 'open')).toBe(false);
  });
  it('shows archived tasks only when the archived filter is on', () => {
    expect(matchesFilter(task({ archived: true }), f({}), 'open')).toBe(false);
    expect(matchesFilter(task({ archived: true }), f({ archived: true }), 'open')).toBe(true);
  });
});

describe('filter state and sorting', () => {
  it('is active when any criterion is set', () => {
    expect(isFilterActive(emptyFilter)).toBe(false);
    expect(isFilterActive({ ...emptyFilter, q: 'x' })).toBe(true);
    expect(isFilterActive({ ...emptyFilter, due: 'week' })).toBe(true);
  });
  it('sorts by created, priority and due, and keeps manual order', () => {
    const a = task({ id: 'a', createdAt: '2027-07-01', priority: 'low', due: '2027-07-20' });
    const b = task({ id: 'b', createdAt: '2027-07-05', priority: 'critical', due: '2027-07-02' });
    const c = task({ id: 'c', createdAt: '2027-07-03', priority: 'high', due: undefined });
    expect(sortTasks([a, b, c], 'manual')).toEqual([a, b, c]);
    expect(sortTasks([a, b, c], 'created').map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(sortTasks([a, b, c], 'priority').map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(sortTasks([a, b, c], 'due').map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('task helpers', () => {
  it('counts finished subtasks', () => {
    expect(subtaskProgress(task())).toEqual({ done: 1, total: 2 });
  });
  it('makes a short id', () => {
    expect(uid()).toMatch(/^[a-z0-9]+$/);
    expect(uid()).not.toBe(uid());
  });
  it('formats file sizes in bytes, kilobytes or megabytes', () => {
    expect(fmtSize(512)).toBe('512 B');
    expect(fmtSize(2048)).toBe('2 KB');
    expect(fmtSize(3 * 1048576)).toBe('3.0 MB');
  });
});

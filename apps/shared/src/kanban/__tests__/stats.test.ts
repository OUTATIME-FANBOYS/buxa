import { describe, expect, it } from 'vitest';
import {
  avgCycleDays,
  completionSeries,
  memberLoad,
  overdueByMember,
  priorityCounts,
  unassignedCount,
  WEEKS_IN_SERIES,
} from '../stats';
import { fmt } from '../../dates';
import type { ColumnKind, Task } from '../types';

const ON = '2026-11-20';
const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString();
const kindOf = (t: Task): ColumnKind => (t.columnId === 'done' ? 'done' : 'open');

function task(id: string, over: Partial<Task>): Task {
  return {
    id,
    projectId: 'p',
    columnId: 'open',
    title: id,
    description: '',
    priority: 'medium',
    subtasks: [],
    comments: [],
    attachments: [],
    history: [],
    archived: false,
    createdAt: at('2026-11-01'),
    createdBy: 'u1',
    ...over,
  };
}

const sum = (points: { value: number }[]) => points.reduce((n, p) => n + p.value, 0);

describe('completionSeries', () => {
  const done = [
    task('a', { columnId: 'done', completedAt: at('2026-11-20') }),
    task('b', { columnId: 'done', completedAt: at('2026-11-06') }),
    task('c', { columnId: 'done', completedAt: at('2026-10-01') }),
  ];

  it('gives one point per day for 14 and 30 days, oldest first, ending on the given day', () => {
    for (const days of [14, 30]) {
      const series = completionSeries(done, days, ON);
      expect(series).toHaveLength(days);
      expect(series.at(-1)).toMatchObject({ label: fmt(ON), title: fmt(ON, true) });
    }
  });

  it('counts a completion on its day, and only inside the window', () => {
    expect(sum(completionSeries(done, 14, ON))).toBe(1); // b is 14 days back, outside a 14-day window
    expect(sum(completionSeries(done, 30, ON))).toBe(2); // c is 50 days back
  });

  it('gives 13 weekly buckets for the 90-day range, each titled with its first and last day', () => {
    const series = completionSeries(done, 90, ON);
    expect(WEEKS_IN_SERIES).toBe(13);
    expect(series).toHaveLength(13);
    expect(series.at(-1)?.title).toBe(`${fmt('2026-11-14')} – ${fmt(ON)}`);
    expect(series.at(0)?.title).toBe(`${fmt('2026-08-22')} – ${fmt('2026-08-28')}`);
  });

  it('documents the 90-day unit: weekly buckets that together cover 91 days, from 90 days before the given day', () => {
    const edge = [
      task('first', { columnId: 'done', completedAt: at('2026-08-22') }), // 90 days back: counted
      task('before', { columnId: 'done', completedAt: at('2026-08-21') }), // 91 days back: not counted
    ];
    expect(sum(completionSeries(edge, 90, ON))).toBe(1);
    expect(sum(completionSeries(done, 90, ON))).toBe(3);
  });
});

describe('avgCycleDays', () => {
  it('averages whole days from creation to completion, skipping done tasks without a completion date', () => {
    const done = [
      task('a', { columnId: 'done', createdAt: at('2026-11-16'), completedAt: at('2026-11-19') }),
      task('b', { columnId: 'done', createdAt: at('2026-11-10'), completedAt: at('2026-11-20') }),
      task('c', { columnId: 'done' }),
    ];
    expect(avgCycleDays(done)).toBe(6.5);
  });

  it('returns null when no done task has a completion date', () => {
    expect(avgCycleDays([])).toBeNull();
    expect(avgCycleDays([task('c', { columnId: 'done' })])).toBeNull();
  });
});

describe('memberLoad and overdueByMember', () => {
  const members = [
    { userId: 'alice', role: 'member' as const },
    { userId: 'bob', role: 'member' as const },
    { userId: 'cara', role: 'member' as const },
  ];
  const open = [
    task('t1', { assigneeId: 'alice', due: '2026-11-18' }),
    task('t2', { assigneeId: 'alice', due: '2026-11-25' }),
    task('t3', { assigneeId: 'bob', due: '2026-11-19' }),
    task('t4', { assigneeId: 'alice' }),
    task('t5', {}),
  ];

  it('splits each member’s open tasks into on track and overdue, busiest first', () => {
    const load = memberLoad(open, members, kindOf, ON);
    expect(load.map(l => [l.member.userId, l.on, l.late])).toEqual([
      ['alice', 2, 1],
      ['bob', 0, 1],
      ['cara', 0, 0],
    ]);
  });

  it('lists only members with overdue work', () => {
    const load = memberLoad(open, members, kindOf, ON);
    expect(overdueByMember(load).map(l => l.member.userId)).toEqual(['alice', 'bob']);
  });

  it('does not count a done task as overdue', () => {
    const done = [task('d', { columnId: 'done', assigneeId: 'cara', due: '2026-11-01' })];
    expect(memberLoad(done, members, kindOf, ON).find(l => l.member.userId === 'cara')).toMatchObject({ late: 0 });
  });
});

describe('priorityCounts and unassignedCount', () => {
  const open = [
    task('t1', { priority: 'critical' }),
    task('t2', { priority: 'medium' }),
    task('t3', { priority: 'medium' }),
    task('t4', { priority: 'low', assigneeId: 'alice' }),
  ];

  it('counts open tasks per priority, lowest first', () => {
    expect(priorityCounts(open)).toEqual([
      { priority: 'low', count: 1 },
      { priority: 'medium', count: 2 },
      { priority: 'high', count: 0 },
      { priority: 'critical', count: 1 },
    ]);
  });

  it('counts open tasks with no assignee', () => {
    expect(unassignedCount(open)).toBe(3);
    expect(unassignedCount([])).toBe(0);
  });
});

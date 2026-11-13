import { describe, expect, it, beforeEach } from 'vitest';
import { buildSeed } from '../seed';
import * as D from '../domain';
import { summarize } from '../stats';
import type { AppState } from '../../types';

let s: AppState;
const as = (state: AppState, userId: string): AppState => ({ ...state, session: { userId } });
const proj = () => s.projects.find(p => p.id === 'p-web')!;
const col = (name: string) => proj().columns.find(c => c.name === name)!.id;
const task = (id: string) => s.tasks.find(t => t.id === id)!;

beforeEach(() => { s = as(buildSeed(), 'u-maya'); });

describe('moveTask', () => {
  it('sets completedAt on entering a done column and clears it on leaving', () => {
    const id = 't-4'; // Write homepage hero copy, assigned to Sofia
    s = D.moveTask(s, id, col('Done'), null);
    expect(task(id).completedAt).toBeTruthy();
    s = D.moveTask(s, id, col('In Progress'), null);
    expect(task(id).completedAt).toBeUndefined();
  });
  it('places a task before the given sibling', () => {
    s = D.moveTask(s, 't-4', col('Backlog'), 't-1');
    const ids = s.tasks.filter(t => t.columnId === col('Backlog')).map(t => t.id);
    expect(ids.indexOf('t-4')).toBeLessThan(ids.indexOf('t-1'));
  });
  it('notifies the assignee but never the actor', () => {
    const before = s.notices.length;
    s = D.moveTask(s, 't-4', col('In Review'), null); // Sofia's task, Maya acts
    expect(s.notices.length).toBe(before + 1);
    expect(s.notices[0].userId).toBe('u-sofia');
    s = D.moveTask(s, 't-8', col('In Review'), null); // Maya's own task
    expect(s.notices.filter(n => n.userId === 'u-maya' && n.text.includes('moved')).length).toBe(0);
  });
  it('records history and activity', () => {
    s = D.moveTask(s, 't-4', col('To Do'), null); // already there → no-op log
    expect(task('t-4').history.length).toBe(1);
    s = D.moveTask(s, 't-4', col('In Review'), null);
    expect(task('t-4').history[0].text).toBe('moved this to In Review');
    expect(s.activity[0].verb).toBe('moved');
  });
});

describe('updateTask', () => {
  it('logs only fields that changed', () => {
    s = D.updateTask(s, 't-4', { title: task('t-4').title, priority: 'critical' });
    expect(task('t-4').history.map(h => h.text)).toContain('changed priority of this to Critical');
    expect(task('t-4').history.some(h => h.text.startsWith('renamed'))).toBe(false);
  });
  it('notifies a new assignee', () => {
    s = D.updateTask(s, 't-4', { assigneeId: 'u-dan' });
    expect(s.notices[0]).toMatchObject({ userId: 'u-dan', kind: 'assign' });
  });
});

describe('addComment', () => {
  it('notifies mentioned users, otherwise the assignee', () => {
    s = D.addComment(s, 't-4', 'Nice work @Daniel');
    expect(s.notices.some(n => n.userId === 'u-dan' && n.kind === 'mention')).toBe(true);
    expect(s.notices.some(n => n.userId === 'u-sofia' && n.kind === 'comment')).toBe(true);
  });
});

describe('columns', () => {
  it('deleteColumn moves tasks and completes them when the target is done', () => {
    s = D.deleteColumn(s, 'p-web', col('In Review'), col('Done'));
    expect(proj().columns.some(c => c.name === 'In Review')).toBe(false);
    expect(task('t-12').columnId).toBe(col('Done'));
    expect(task('t-12').completedAt).toBeTruthy();
  });
  it('moveColumn reorders', () => {
    s = D.moveColumn(s, 'p-web', col('Done'), col('Backlog'));
    expect(proj().columns[0].name).toBe('Done');
  });
});

describe('updateColumn kind change', () => {
  it('backfills completedAt when a column becomes done, and clears it when it stops being done', () => {
    expect(task('t-12').completedAt).toBeUndefined(); // In Review
    s = D.updateColumn(s, 'p-web', col('In Review'), { kind: 'done' });
    expect(task('t-12').completedAt).toBeTruthy();
    s = D.updateColumn(s, 'p-web', col('Done'), { kind: 'active' });
    expect(task('t-12').completedAt).toBeTruthy(); // still in the (now done) In Review column
    expect(s.tasks.filter(t => t.columnId === col('Done')).every(t => !t.completedAt)).toBe(true);
  });
  it('renaming alone leaves completion untouched', () => {
    const id = col('Done'); const before = s.tasks.filter(t => t.columnId === id).map(t => t.completedAt);
    s = D.updateColumn(s, 'p-web', id, { name: 'Shipped' });
    expect(s.tasks.filter(t => t.columnId === id).map(t => t.completedAt)).toEqual(before);
  });
});

describe('invite', () => {
  it('rejects duplicates and adds pending users', () => {
    expect(D.invite(s, 'w-nw', 'daniel@northwind.studio', 'member').error).toMatch(/already/);
    const r = D.invite(s, 'w-nw', 'new.person@x.io', 'viewer');
    expect(r.error).toBeNull();
    expect(r.state.users.find(u => u.email === 'new.person@x.io')).toMatchObject({ pending: true, name: 'New Person' });
  });
});

describe('stats', () => {
  it('one definition of done/overdue/progress', () => {
    const kindOf = (t: AppState['tasks'][number]) => s.projects.find(p => p.id === t.projectId)!.columns.find(c => c.id === t.columnId)!.kind;
    const r = summarize(s.tasks.filter(t => t.projectId === 'p-web'), kindOf);
    expect(r.progress.total).toBe(r.done.length + r.open.length);
    expect(r.overdue.every(t => kindOf(t) !== 'done')).toBe(true);
  });
});

describe('healthOf', () => {
  const pr = (done: number, total: number) => ({ done, total, pct: total ? (done / total) * 100 : 0 });
  it('classifies a project against its deadline', async () => {
    const { healthOf } = await import('../stats');
    expect(healthOf(pr(4, 4), '2026-01-01', '2026-06-01')).toBe('done');   // finished beats a passed deadline
    expect(healthOf(pr(1, 4), '2026-05-01', '2026-06-01')).toBe('late');
    expect(healthOf(pr(1, 4), '2026-06-05', '2026-06-01')).toBe('risk');   // a week out and under 80%
    expect(healthOf(pr(9, 10), '2026-06-05', '2026-06-01')).toBe('track'); // close, but nearly done
    expect(healthOf(pr(0, 4), '2026-09-01', '2026-06-01')).toBe('track');
    expect(healthOf(pr(0, 0), undefined, '2026-06-01')).toBe('track');
  });
});

describe('createTask defaults', () => {
  it('an explicit undefined never erases a default', () => {
    const next = D.createTask(s, 'new-1', { projectId: 'p-web', columnId: col('Backlog'), title: 'x', description: undefined, priority: undefined, tags: undefined });
    expect(task('new-1')).toBeUndefined(); // (s is the old state)
    const t = next.tasks.find(x => x.id === 'new-1')!;
    expect(t).toMatchObject({ description: '', priority: 'medium', tags: [] });
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Dialog as ConfirmDialog } from '@/components/components';
import { buildSeed, fmt } from '@buxa/shared';
import type { ColumnKind, Task } from '@buxa/shared';
import { Reports } from '@/components/views/kanban';
import { requirePresent } from '@buxa/domain';

// Pins what the Reports view prints today for one fixed set of tasks, so the derivations can move out of the view
// without changing a number. "Today" is 2026-11-20 (local time).

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
  usePathname: () => '/camp/reports',
}));

const DONE_COLUMN = 'col-done';
const kindOf = (t: Task): ColumnKind => (t.columnId === DONE_COLUMN ? 'done' : 'open');
const ago = (days: number, hour = 12) => new Date(2026, 10, 20 - days, hour).toISOString();

const seed = buildSeed();
const project = requirePresent(seed.projects[0], 'seed.projects[0]');
const members = seed.workspaces[0].members.map(m => ({
  userId: m.userId,
  role: m.role,
  user: requirePresent(
    seed.users.find(u => u.id === m.userId),
    'seed.users.find((u) => u.id === m.userId)',
  ),
}));
const [alice, bob] = members;
const firstName = (index: number) => requirePresent(members[index], `members[${index}]`).user.name.split(' ')[0];

/** A task with the fields the view reads; `over` sets only what differs. */
function task(id: string, over: Partial<Task>): Task {
  return {
    id,
    projectId: project.id,
    columnId: 'col-open',
    title: `Task ${id}`,
    description: '',
    priority: 'medium',
    subtasks: [],
    comments: [],
    attachments: [],
    history: [],
    archived: false,
    createdAt: ago(10),
    createdBy: alice.userId,
    ...over,
  };
}

// Live done tasks: t1 (3 days to complete), t2 (10 days), t3 (10 days, 20 days ago), t4 (3 days, 50 days ago), t11 (no completedAt).
// Archived done task t5 is ignored everywhere. Open: t6 overdue, t7 on track, t8 unassigned, t9 overdue, t10 archived.
const tasks: Task[] = [
  task('t1', {
    columnId: DONE_COLUMN,
    priority: 'high',
    assigneeId: alice.userId,
    createdAt: ago(4),
    completedAt: ago(1),
  }),
  task('t2', {
    columnId: DONE_COLUMN,
    priority: 'low',
    assigneeId: bob.userId,
    createdAt: ago(10),
    completedAt: ago(0),
  }),
  task('t3', { columnId: DONE_COLUMN, createdAt: ago(30), completedAt: ago(20) }),
  task('t4', { columnId: DONE_COLUMN, createdAt: ago(53), completedAt: ago(50) }),
  task('t5', { columnId: DONE_COLUMN, archived: true, assigneeId: alice.userId, completedAt: ago(0) }),
  task('t6', { priority: 'critical', assigneeId: alice.userId, createdAt: ago(5), due: '2026-11-18' }),
  task('t7', { priority: 'medium', assigneeId: alice.userId, due: '2026-11-25' }),
  task('t8', { priority: 'medium' }),
  task('t9', { priority: 'low', assigneeId: bob.userId, due: '2026-11-19' }),
  task('t10', { priority: 'high', assigneeId: alice.userId, archived: true, due: '2026-11-01' }),
  task('t11', { columnId: DONE_COLUMN, createdAt: ago(3) }),
];

function store(over: Record<string, unknown> = {}) {
  return {
    s: seed,
    actions: {
      setTheme() {},
      setView() {},
      selectProject() {},
      setAgentsEnabled() {},
      updateUser() {},
      exportData: () => '{}',
      importData: () => null,
      simulateRun: () => 0,
    },
    me: members[0].user,
    workspace: seed.workspaces[0],
    project,
    projects: seed.projects,
    wsTasks: tasks,
    kindOf,
    members,
    myRole: 'owner',
    readOnly: false,
    userById: (id?: string) => seed.users.find(u => u.id === id),
    saveStatus: 'saved',
    sync: 'local',
    ...over,
  };
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** jsdom has no ResizeObserver; the charts only use it to measure their width. */
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

/** Mounts the view and returns its markup. `range` clicks the time-range control first. */
function render(range?: '14' | '30' | '90'): string {
  act(() => {
    root.render(
      <UiProvider Dialog={ConfirmDialog}>
        <Reports />
      </UiProvider>,
    );
  });
  if (range) {
    const option = requirePresent(
      container.querySelector<HTMLButtonElement>(`[role="radio"][title="${range} days"]`),
      `range control ${range} days`,
    );
    act(() => option.click());
  }

  return container.innerHTML;
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', NoopResizeObserver);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 20, 12));
  h.store = store();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Reports today (characterization)', () => {
  it('shows the completion rate over live tasks and the open and overdue counts', () => {
    const html = render();
    // 5 live done of 9 live tasks; 4 open, 2 of them overdue (t6, t9)
    expect(html).toContain('56%');
    expect(html).toContain('5 of 9 tasks');
    expect(html).toContain('50% of open tasks');
  });

  it('counts completions per day over the default 30-day range, and per week in the note', () => {
    const html = render();
    expect(html).toContain('Tasks completed over the last 30 days, 3 in total');
    expect(html).toContain('Completed, 30 days');
    expect(html).toContain('0.7 per week');
  });

  it('counts completions per day over the 14-day range', () => {
    const html = render('14');
    // t1 (1 day ago) and t2 (today); t3 is 20 days ago, outside the range
    expect(html).toContain('Tasks completed over the last 14 days, 2 in total');
    expect(html).toContain('Completed, 14 days');
    expect(html).toContain('1.0 per week');
  });

  it('counts completions in 13 weekly buckets over the 90-day range', () => {
    const html = render('90');
    // t1 and t2 share the last week; t3 (20 days ago) and t4 (50 days ago) fall in earlier weeks
    expect(html).toContain('Tasks completed over the last 90 days, 4 in total');
    expect(html).toContain('Completed, 90 days');
    expect(html).toContain('0.3 per week');
    expect(html).toContain('Tasks completed per week, last 90 days');
    expect(html).toContain(`${fmt('2026-11-14')} – ${fmt('2026-11-20')}`);
  });

  it('averages creation-to-done days over the done tasks that have a completion date', () => {
    const html = render();
    // t1 3d, t2 10d, t3 10d, t4 3d; t11 has no completedAt and is left out
    expect(html).toContain('6.5d');
    expect(html).toContain('from creation to done');
  });

  it('prints unassigned open tasks and overdue counts per member', () => {
    const html = render();
    expect(html).toContain('1 open task is unassigned.');
    // Alice: t7 on track, t6 overdue. Bob: t9 overdue only.
    expect(html).toContain(`title="1 on track, 1 overdue"`);
    expect(html).toContain(firstName(0));
    expect(html).toContain('title="1 overdue"');
    expect(html).toContain('Overdue tasks per team member');
  });

  it('counts open tasks by priority, critical first', () => {
    const html = render();
    // open: t6 critical, t7 and t8 medium, t9 low; high has none
    expect(html).toContain('aria-label="Open tasks by priority"');
    expect(html).toContain('title="2 open"');
    expect(html.match(/title="1 open"/g)?.length).toBe(2);
    expect(html.indexOf('Critical')).toBeLessThan(html.indexOf('Low'));
  });
});

describe('Reports with no tasks', () => {
  const statRows = () =>
    Array.from(container.querySelectorAll('.stat'), stat => ({
      label: stat.querySelector('.stat-label')?.textContent,
      value: stat.querySelector('.stat-num')?.textContent,
    }));
  const panelFor = (title: string) =>
    Array.from(container.querySelectorAll('section.panel')).find(p => p.querySelector('h2')?.textContent === title);

  beforeEach(() => {
    h.store = store({ wsTasks: [] });
  });

  it('keeps the header, all four stat cards and every chart card, with zero values', () => {
    render();
    expect(container.querySelector('h1')?.textContent).toBe('Reports');
    expect(statRows()).toEqual([
      { label: 'Completion rate', value: '0%' },
      { label: 'Completed, 30 days', value: '0' },
      { label: 'Avg. time to complete', value: '–' },
      { label: 'Overdue', value: '0' },
    ]);
    expect(container.querySelector('[aria-label="Time range"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Tasks completed over the last 30 days, 0 in total"]')).not.toBeNull();
    expect(container.querySelectorAll('.chart-card')).toHaveLength(1);
    for (const title of ['Project progress', 'Workload by member', 'Open tasks by priority', 'Overdue']) {
      expect(panelFor(title)).toBeDefined();
    }
  });

  it('shows a short empty message inside each chart card that has no data', () => {
    render();
    expect(container.querySelector('.chart-card')?.textContent).toContain('No completed tasks in this period yet');
    expect(panelFor('Workload by member')?.textContent).toContain('No open tasks yet.');
    expect(panelFor('Open tasks by priority')?.textContent).toContain('No open tasks yet.');
    expect(panelFor('Overdue')?.textContent).toContain('No one has overdue work.');
  });

  it('never shows a whole-page "Nothing to report yet" message', () => {
    expect(render()).not.toContain('Nothing to report yet');
  });

  it('still renders the layout when there is no workspace', () => {
    h.store = store({ wsTasks: [], workspace: null, projects: [], members: [] });
    render();
    expect(container.querySelector('h1')?.textContent).toBe('Reports');
    expect(statRows()).toHaveLength(4);
    expect(container.querySelectorAll('.chart-card')).toHaveLength(1);
    expect(container.innerHTML).not.toContain('Nothing to report yet');
  });
});

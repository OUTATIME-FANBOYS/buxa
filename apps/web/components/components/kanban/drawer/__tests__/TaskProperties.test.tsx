import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { TaskProperties } from '@/components/components/kanban/drawer';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));

const seed = buildSeed();
const project = seed.projects[0];
const draft = {
  columnId: project.columns[0].id,
  priority: 'medium',
  assignee: undefined,
  start: '',
  due: '2027-07-10',
  setColumnId() {},
  changeDates() {},
  errs: {},
} as Record<string, unknown>;

describe('TaskProperties', () => {
  beforeEach(() => {
    h.store = {
      actions: {},
      members: seed.workspaces[0].members.map(m => ({
        userId: m.userId,
        user: seed.users.find(u => u.id === m.userId),
      })),
      wsTasks: seed.tasks,
    };
  });

  it('shows status, priority, assignee and the dates for a new task from the draft', () => {
    const html = renderToStaticMarkup(<TaskProperties task={null} project={project} d={draft as never} />);
    for (const label of ['Status', 'Priority', 'Assignee', 'Start date', 'Due date']) {
      expect(html).toMatch(new RegExp(`>${label}</(span|label)>`));
    }
    expect(html).toContain('value="2027-07-10"');
    expect(html).toContain('>Unassigned</option>');
  });
  it('shows a saved task’s own values, and the due-date error when there is one', () => {
    const task = { ...seed.tasks[0], priority: 'critical' } as never;
    const html = renderToStaticMarkup(
      <TaskProperties
        task={task}
        project={project}
        d={{ ...draft, errs: { due: 'Due date is before the start.' } } as never}
      />,
    );
    expect(html).toContain('Due date is before the start.');
    expect(html).toMatch(/<option value="critical" selected="">Critical<\/option>/);
  });
  it('colours the status field by its status, and lists each status by its plain name', () => {
    const col = project.columns[2];
    const task = { ...seed.tasks[0], columnId: col.id } as never;
    const html = renderToStaticMarkup(<TaskProperties task={task} project={project} d={draft as never} />);
    expect(html).toContain('border-[var(--status-orange)]!');
    expect(html).toContain('text-[var(--status-orange-ink)]!');
    expect(html).toContain(`<option value="${col.id}" selected="">${col.name}</option>`);
    expect(html).toContain('>To Do</option>');
  });
  it('shows no emoji in the status field, on the chosen value or on any option', () => {
    const col = project.columns[2];
    const task = { ...seed.tasks[0], columnId: col.id } as never;
    const html = renderToStaticMarkup(<TaskProperties task={task} project={project} d={draft as never} />);
    const field = html.slice(html.indexOf('>Status</label>'), html.indexOf('</select>') + '</select>'.length);
    expect(field.match(/\p{Extended_Pictographic}/gu)).toBeNull();
  });
  it('gives the New task form the same priority field as the drawer: the signal inside the select, not over the label', () => {
    const html = renderToStaticMarkup(<TaskProperties task={null} project={project} d={draft as never} />);
    expect(html).toMatch(/<div class="buxa:relative"><span class="prio prio-medium /);
    expect(html).not.toMatch(/top-\[10px\]/);
  });
  it('puts status, priority and assignee on one line of three equal columns, and the dates on a line of two', () => {
    const html = renderToStaticMarkup(<TaskProperties task={null} project={project} d={draft as never} />);
    const [first, second] = html.split('<div class="buxa:grid buxa:grid-cols-[repeat(2,minmax(0,1fr))]');
    expect(first).toContain('buxa:grid-cols-[repeat(3,minmax(0,1fr))]');
    expect(first.indexOf('>Status</label>')).toBeLessThan(first.indexOf('>Priority</label>'));
    expect(first.indexOf('>Priority</label>')).toBeLessThan(first.indexOf('>Assignee</label>'));
    expect(first).not.toContain('Start date');
    expect(second).toContain('>Start date</label>');
    expect(second).toContain('>Due date</label>');
    expect(html).not.toContain('Tags');
  });
  it('colours the priority field with the chosen priority token and draws its signal inside the field', () => {
    const task = { ...seed.tasks[0], priority: 'critical' } as never;
    const html = renderToStaticMarkup(<TaskProperties task={task} project={project} d={draft as never} />);
    expect(html).toContain('border-[var(--p-critical)]!');
    expect(html).toContain('text-[var(--p-critical)]!');
    expect(html).toMatch(/<div class="buxa:relative"><span class="prio prio-critical /);
  });
});

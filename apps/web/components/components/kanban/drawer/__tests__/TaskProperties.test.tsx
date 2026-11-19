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
  tags: ['family'],
  setColumnId() {},
  changeDates() {},
  setTags() {},
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

  it('shows status, priority, assignee, dates and tags for a new task from the draft', () => {
    const html = renderToStaticMarkup(<TaskProperties task={null} project={project} d={draft as never} />);
    for (const label of ['Status', 'Priority', 'Assignee', 'Start date', 'Due date', 'Tags']) {
      expect(html).toMatch(new RegExp(`>${label}</(span|label)>`));
    }
    expect(html).toContain('value="2027-07-10"');
    expect(html).toContain('>Unassigned</option>');
  });
  it('shows a saved task’s own values, and the due-date error when there is one', () => {
    const task = { ...seed.tasks[0], priority: 'critical', tags: [] } as never;
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
  it('colours the status field by its status and keeps the status emoji on each option', () => {
    const col = project.columns[2];
    const task = { ...seed.tasks[0], columnId: col.id, tags: [] } as never;
    const html = renderToStaticMarkup(<TaskProperties task={task} project={project} d={draft as never} />);
    expect(html).toContain('border-[var(--st-progress)]!');
    expect(html).toContain('text-[var(--st-progress)]!');
    expect(html).toContain(`>🔨 ${col.name}</option>`);
    expect(html).toContain('>📝 To Do</option>');
  });
  it('shows the status emoji once, beside the chosen value, and not in a slot over the field', () => {
    const col = project.columns[2];
    const task = { ...seed.tasks[0], columnId: col.id, tags: [] } as never;
    const html = renderToStaticMarkup(<TaskProperties task={task} project={project} d={draft as never} />);
    const field = html.slice(html.indexOf('>Status</label>'), html.indexOf('</select>') + '</select>'.length);
    const emoji = /\p{Extended_Pictographic}/gu;
    // Outside the options there is no emoji at all: no leading slot laid over the select.
    expect(field.replace(/<option[\s\S]*?<\/option>/g, '').match(emoji)).toBeNull();
    // The chosen option carries its one emoji, and the list keeps one per option.
    expect(field).toMatch(new RegExp(`<option value="${col.id}" selected="">🔨 ${col.name}</option>`));
    expect(field.match(emoji)).toHaveLength(project.columns.length);
  });
  it('gives the New task form the same priority field as the drawer: the signal inside the select, not over the label', () => {
    const html = renderToStaticMarkup(<TaskProperties task={null} project={project} d={draft as never} />);
    expect(html).toMatch(/<div class="buxa:relative"><span class="prio prio-medium /);
    expect(html).not.toMatch(/top-\[10px\]/);
  });
  it('lines the Tags field up with its neighbours: same wrapper as the selects and dates, and a control-height box', () => {
    const html = renderToStaticMarkup(<TaskProperties task={null} project={project} d={draft as never} />);
    expect(html).toMatch(/<div class="select-field [^"]*"><span class="field-label [^"]*">Tags<\/span>/);
    expect(html).toContain('min-h-[var(--control-h)]');
    expect(html).not.toContain('min-h-[36px]');
  });
  it('colours the priority field with the chosen priority token and draws its signal inside the field', () => {
    const task = { ...seed.tasks[0], priority: 'critical', tags: [] } as never;
    const html = renderToStaticMarkup(<TaskProperties task={task} project={project} d={draft as never} />);
    expect(html).toContain('border-[var(--p-critical)]!');
    expect(html).toContain('text-[var(--p-critical)]!');
    expect(html).toMatch(/<div class="buxa:relative"><span class="prio prio-critical /);
  });
});

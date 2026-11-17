import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { TaskProperties } from '../TaskProperties';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));

const seed = buildSeed();
const project = seed.projects[0];
const draft = {
  columnId: project.columns[0].id, priority: 'medium', assignee: undefined, start: '', due: '2027-07-10', tags: ['family'],
  setColumnId() {}, changeDates() {}, setTags() {}, errs: {},
} as Record<string, unknown>;

describe('TaskProperties', () => {
  beforeEach(() => {
    h.store = { actions: {}, members: seed.workspaces[0].members.map((m) => ({ userId: m.userId, user: seed.users.find((u) => u.id === m.userId) })), wsTasks: seed.tasks };
  });

  it('shows status, priority, assignee, dates and tags for a new task from the draft', () => {
    const html = renderToStaticMarkup(<TaskProperties task={null} project={project} d={draft as never} />);
    for (const label of ['Status', 'Priority', 'Assignee', 'Start date', 'Due date', 'Tags']) expect(html).toContain(`>${label}</span>`);
    expect(html).toContain('value="2027-07-10"');
    expect(html).toContain('>Unassigned</option>');
  });
  it('shows a saved task’s own values, and the due-date error when there is one', () => {
    const task = { ...seed.tasks[0], priority: 'critical', tags: [] } as never;
    const html = renderToStaticMarkup(<TaskProperties task={task} project={project} d={{ ...draft, errs: { due: 'Due date is before the start.' } } as never} />);
    expect(html).toContain('Due date is before the start.');
    expect(html).toMatch(/<option value="critical" selected="">Critical<\/option>/);
  });
});

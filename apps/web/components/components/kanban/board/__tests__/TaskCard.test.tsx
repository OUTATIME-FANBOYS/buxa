import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { type Task } from '@buxa/shared';
import { TaskCard } from '@/components/components/kanban/board';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));
vi.mock('@buxa/middleware/hooks/useTaskCommands', () => ({
  useTaskCommands: () => ({ open() {}, duplicate() {}, moveTo() {}, toggleArchive() {}, remove() {} }),
}));

const seed = buildSeed();
const project = seed.projects[0];
const task: Task = {
  ...seed.tasks[0],
  projectId: project.id,
  columnId: project.columns[1].id,
  title: 'Send welcome email',
  priority: 'high',
  assigneeId: seed.users[0].id,
  tags: ['family'],
  subtasks: [
    { id: 's1', title: 'a', done: true },
    { id: 's2', title: 'b', done: false },
  ],
  comments: [],
  attachments: [],
  archived: false,
};

describe('TaskCard', () => {
  beforeEach(() => {
    h.store = { userById: (id?: string) => seed.users.find(u => u.id === id), kindOf: () => 'open' };
  });

  it('is a focusable card labelled with the title, column, priority and assignee', () => {
    const html = renderToStaticMarkup(
      <TaskCard task={task} project={project} readOnly={false} dragging={false} onGrab={() => undefined} />,
    );
    expect(html).toContain('data-card-id="t-1"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain(
      `aria-label="Send welcome email. ${project.columns[1].name}. high priority. Assigned to ${seed.users[0].name.split(' ')[0]}."`,
    );
    expect(html).toContain('<h3>Send welcome email</h3>');
  });
  it('shows the subtask progress and the tag', () => {
    const html = renderToStaticMarkup(
      <TaskCard task={task} project={project} readOnly={false} dragging={false} onGrab={() => undefined} />,
    );
    expect(html).toContain('1/2');
    expect(html).toContain('>family</span>');
  });
  it('marks a dragged card and an archived one', () => {
    const html = renderToStaticMarkup(
      <TaskCard task={{ ...task, archived: true }} project={project} readOnly dragging onGrab={() => undefined} />,
    );
    expect(html).toContain('is-dragging');
    expect(html).toContain('is-archived');
    expect(html).toContain('>Archived</span>');
  });
});

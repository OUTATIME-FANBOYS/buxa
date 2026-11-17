import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { TaskDrawerHeader } from '../TaskDrawerHeader';

vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));
vi.mock('@buxa/middleware/hooks/useTaskCommands', () => ({ useTaskCommands: () => ({ duplicate: () => 'x', toggleArchive() {} }) }));

const seed = buildSeed();
const project = seed.projects[0];

describe('TaskDrawerHeader', () => {
  it('names the project for a new task, with a close button and no task menu', () => {
    const html = renderToStaticMarkup(<TaskDrawerHeader task={null} project={project} readOnly={false} onClose={() => undefined} onDelete={() => undefined} />);
    expect(html).toContain(`${project.name}`);
    expect(html).toContain('New task');
    expect(html).toContain('aria-label="Close task"');
    expect(html).not.toContain('Task actions');
  });
  it('shows the task’s column and the actions menu to editors, but not to read-only members', () => {
    const task = seed.tasks.find((t) => t.projectId === project.id)!;
    const editor = renderToStaticMarkup(<TaskDrawerHeader task={task} project={project} readOnly={false} onClose={() => undefined} onDelete={() => undefined} />);
    expect(editor).toContain('aria-label="Task actions"');
    expect(editor).toContain(project.columns.find((c) => c.id === task.columnId)!.name);
    const viewer = renderToStaticMarkup(<TaskDrawerHeader task={task} project={project} readOnly onClose={() => undefined} onDelete={() => undefined} />);
    expect(viewer).not.toContain('Task actions');
  });
});

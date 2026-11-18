import { describe, expect, it, vi } from 'vitest';
import { buildSeed } from '@buxa/shared';
import { taskMenuItems } from '@/components/components/kanban/board/export';
import { requirePresent } from '@buxa/domain';

const seed = buildSeed();
const project = seed.projects[0];
const task = {
  ...requirePresent(
    seed.tasks.find(t => t.projectId === project.id),
    'seed.tasks.find((t) => t.projectId === project.id)',
  ),
  archived: false,
};

function commands() {
  return { open: vi.fn(), duplicate: vi.fn(), moveTo: vi.fn(), toggleArchive: vi.fn(), remove: vi.fn() };
}

describe('taskMenuItems', () => {
  it('gives read-only members only Open', () => {
    const items = taskMenuItems(task, project, true, commands());
    expect(items.map(i => i && i.label)).toEqual(['Open']);
  });
  it('gives editors the full menu, with a move for every other column', () => {
    const items = taskMenuItems(task, project, false, commands() as never).filter(Boolean) as { label: string }[];
    expect(items[0].label).toBe('Open');
    expect(items.map(i => i.label)).toContain('Duplicate');
    expect(items.filter(i => i.label.startsWith('Move to ')).length).toBe(project.columns.length - 1);
    expect(items.at(-2)?.label).toBe('Archive');
    expect(items.at(-1)?.label).toBe('Delete');
  });
  it('offers Restore for an archived task', () => {
    const items = taskMenuItems({ ...task, archived: true }, project, false, commands() as never).filter(Boolean) as {
      label: string;
    }[];
    expect(items.map(i => i.label)).toContain('Restore');
  });
  it('runs the matching command when an item is chosen', () => {
    const cmd = commands();
    const items = taskMenuItems(task, project, false, cmd as never).filter(Boolean) as {
      label: string;
      onSelect: () => void;
    }[];
    requirePresent(
      items.find(i => i.label === 'Duplicate'),
      "items.find((i) => i.label === 'Duplicate')",
    ).onSelect();
    expect(cmd.duplicate).toHaveBeenCalledWith(task);
  });
});

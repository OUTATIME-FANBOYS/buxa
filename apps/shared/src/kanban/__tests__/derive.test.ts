import { describe, expect, it } from 'vitest';
import { buildSeed } from '../seed/buildSeed';
import { deriveView } from '../derive';

describe('deriveView', () => {
  it('has no user, workspace or project when nobody is signed in', () => {
    const view = deriveView({ ...buildSeed(), session: { userId: null } });
    expect(view.me).toBeNull();
    expect(view.workspace).toBeNull();
    expect(view.projects).toEqual([]);
    expect(view.myRole).toBe('viewer');
    expect(view.readOnly).toBe(true);
  });
  it('resolves the signed-in user, their workspace and the selected project', () => {
    const seed = buildSeed();
    const userId = seed.workspaces[0].members[0].userId;
    const view = deriveView({ ...seed, session: { userId } });
    expect(view.me?.id).toBe(userId);
    expect(view.workspace?.id).toBe(seed.ui.workspaceId);
    expect(view.project?.id).toBe(seed.ui.projectId);
    expect(view.projects.every((p) => p.workspaceId === view.workspace?.id)).toBe(true);
    expect(view.members.every((m) => m.user)).toBe(true);
    expect(view.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('maps every column to its kind, defaulting to open', () => {
    const seed = buildSeed();
    const view = deriveView({ ...seed, session: { userId: seed.workspaces[0].members[0].userId } });
    const task = view.wsTasks[0];
    expect(view.kindOf(task)).toBe(seed.projects.find((p) => p.id === task.projectId)?.columns.find((c) => c.id === task.columnId)?.kind);
    expect(view.kindOf({ ...task, columnId: 'missing' })).toBe('open');
  });
});

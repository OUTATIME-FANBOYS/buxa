import { describe, expect, it } from 'vitest';
import { buildSeed } from '../seed/buildSeed';
import { USER } from '../seed/ids';
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
    expect(view.projects.every(p => p.workspaceId === view.workspace?.id)).toBe(true);
    expect(view.members.every(m => m.user)).toBe(true);
    expect(view.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  describe('camp role', () => {
    // A camp member who has no kanban membership in the camp's workspace.
    const outsider = () => {
      const seed = buildSeed();
      const id = 'user-not-on-board';
      const state = {
        ...seed,
        users: [...seed.users, { id, name: 'Outside Person', email: 'outside@example.com' }],
        session: { userId: id },
      };

      return { seed, state };
    };
    const campProjects = (seed: ReturnType<typeof buildSeed>) =>
      seed.projects.filter(p => p.workspaceId === seed.ui.workspaceId);

    it('gives an owner who is not a kanban member every project in the camp, with full rights', () => {
      const { seed, state } = outsider();
      const view = deriveView(state, 'owner');
      expect(view.workspace?.id).toBe(seed.ui.workspaceId);
      expect(view.projects.map(p => p.id)).toEqual(campProjects(seed).map(p => p.id));
      expect(view.projects.length).toBeGreaterThan(0);
      expect(view.myRole).toBe('owner');
      expect(view.readOnly).toBe(false);
    });
    it('gives an admin the same full rights, as the kanban admin role', () => {
      const { seed, state } = outsider();
      const view = deriveView(state, 'admin');
      expect(view.projects.length).toBe(campProjects(seed).length);
      expect(view.myRole).toBe('admin');
      expect(view.readOnly).toBe(false);
    });
    it('lets staff work on tasks (kanban member) but not as viewers', () => {
      const { state } = outsider();
      const view = deriveView(state, 'staff');
      expect(view.myRole).toBe('member');
      expect(view.readOnly).toBe(false);
    });
    it('keeps a viewer read-only while they can still see the camp projects', () => {
      const { seed, state } = outsider();
      const view = deriveView(state, 'viewer');
      expect(view.myRole).toBe('viewer');
      expect(view.readOnly).toBe(true);
      expect(view.projects.length).toBe(campProjects(seed).length);
    });
    it('lets the camp role replace a weaker kanban membership role', () => {
      const seed = buildSeed();
      const workspaces = seed.workspaces.map(w => ({
        ...w,
        members: w.members.map(m => (m.userId === USER.rosa ? { ...m, role: 'viewer' as const } : m)),
      }));
      const state = { ...seed, workspaces, session: { userId: USER.rosa } };
      expect(deriveView(state, 'owner').readOnly).toBe(false);
      expect(deriveView(state, 'owner').myRole).toBe('owner');
    });
    it('falls back to the kanban membership when there is no camp role', () => {
      const seed = buildSeed();
      const view = deriveView({ ...seed, session: { userId: USER.rosa } });
      expect(view.myRole).toBe('owner');
      expect(deriveView(outsider().state).workspace).toBeNull();
    });
  });
  it('maps every column to its kind, defaulting to open', () => {
    const seed = buildSeed();
    const view = deriveView({ ...seed, session: { userId: seed.workspaces[0].members[0].userId } });
    const task = view.wsTasks[0];
    expect(view.kindOf(task)).toBe(
      seed.projects.find(p => p.id === task.projectId)?.columns.find(c => c.id === task.columnId)?.kind,
    );
    expect(view.kindOf({ ...task, columnId: 'missing' })).toBe('open');
  });
});

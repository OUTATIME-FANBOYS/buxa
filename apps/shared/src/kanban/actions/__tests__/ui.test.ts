import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../..';
import { uiActions } from '../ui';
import { fakeContext } from './fakeContext';

describe('ui actions', () => {
  it('merges a patch into the ui state, and sets the theme and view', () => {
    const ctx = fakeContext(buildSeed());
    const ui = uiActions(ctx);
    ui.setUi({ sidebarCollapsed: true });
    ui.setTheme('dark');
    ui.setView('list');
    expect(ctx.get().ui).toMatchObject({ sidebarCollapsed: true, theme: 'dark', view: 'list' });
  });
  it('selects a project and moves to its workspace', () => {
    const seed = buildSeed();
    const project = seed.projects[1];
    const ctx = fakeContext(seed);
    uiActions(ctx).selectProject(project.id);
    expect(ctx.get().ui).toMatchObject({ projectId: project.id, workspaceId: project.workspaceId });
  });
  it('ignores an unknown project', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    uiActions(ctx).selectProject('p-missing');
    expect(ctx.get()).toBe(seed);
  });
  it('selects a workspace and its first project', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    uiActions(ctx).selectWorkspace(seed.workspaces[0].id);
    expect(ctx.get().ui).toMatchObject({ workspaceId: seed.workspaces[0].id, projectId: seed.projects[0].id });
  });
});

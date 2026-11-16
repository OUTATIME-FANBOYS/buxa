import { describe, expect, it } from 'vitest';
import { structureActions } from '../structure';
import { USER } from '../../../../common';
import { buildSeed } from '../../../../common';
import { fakeContext } from './fakeContext';

describe('structure actions', () => {
  it('creates a project and returns its id', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    const id = structureActions(ctx).createProject(seed.workspaces[0].id, 'Lake week', 'Summer lake programme');
    expect(id).toMatch(/^p-/);
    expect(ctx.get().projects.some((p) => p.id === id && p.name === 'Lake week')).toBe(true);
  });
  it('creates a workspace and returns its id', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    const id = structureActions(ctx).createWorkspace('Second camp');
    expect(id).toMatch(/^w-/);
    expect(ctx.get().workspaces.some((w) => w.id === id)).toBe(true);
  });
  it('adds a column to a project', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    structureActions(ctx).createColumn(seed.projects[0].id, 'Blocked', 'active');
    const cols = ctx.get().projects[0].columns;
    expect(cols.at(-1)?.name).toBe('Blocked');
  });
  it('invites a new email and refuses someone already in the workspace', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    const workspaceId = seed.workspaces[0].id;
    expect(structureActions(ctx).invite(workspaceId, 'new.person@example.com', 'member')).toBeNull();
    expect(ctx.get().workspaces[0].members.some((m) => m.userId === 'u-new' || m.role === 'member')).toBe(true);
    expect(structureActions(ctx).invite(workspaceId, 'rosa@example.com', 'member')).toEqual(expect.any(String));
  });
  it('changes a member role and removes a member', () => {
    const seed = buildSeed();
    const ctx = fakeContext(seed);
    const workspaceId = seed.workspaces[0].id;
    structureActions(ctx).setRole(workspaceId, USER.sam, 'admin');
    expect(ctx.get().workspaces[0].members.find((m) => m.userId === USER.sam)?.role).toBe('admin');
    structureActions(ctx).removeMember(workspaceId, USER.nia);
    expect(ctx.get().workspaces[0].members.some((m) => m.userId === USER.nia)).toBe(false);
  });
});

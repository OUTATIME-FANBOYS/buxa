import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from '@buxa/domain';
import { renameMemberAction } from '../renameMemberAction';

const TARGET = '6f1d2c3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  users: { roleIn: vi.fn(), renameMember: vi.fn() },
  revalidatePath: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ repositories: { users: h.users } }) }));
vi.mock('../../people/camp', () => ({ currentActor: () => settle(() => h.actor) }));

describe('renameMemberAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'admin' };
    h.users.roleIn.mockResolvedValue('viewer');
    h.users.renameMember.mockResolvedValue({ id: TARGET, email: 'a@example.test', name: 'Rosa Delgado' });
  });

  it('hands the acting person to the repository, so the rename is audited against them and this camp', async () => {
    const state = await renameMemberAction({ userId: TARGET, name: 'Rosa Delgado' });
    expect(state).toEqual({ status: 'success', message: 'Name saved' });
    expect(h.users.renameMember).toHaveBeenCalledWith(h.actor, TARGET, 'Rosa Delgado');
  });

  it('a staff member cannot rename, and nothing is written', async () => {
    h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
    const state = await renameMemberAction({ userId: TARGET, name: 'Rosa Delgado' });
    expect(state).toMatchObject({ status: 'error', message: 'You cannot rename this person.' });
    expect(h.users.renameMember).not.toHaveBeenCalled();
  });

  it('a person who is not in the camp is refused before anything is written', async () => {
    h.users.roleIn.mockResolvedValueOnce(null);
    const state = await renameMemberAction({ userId: TARGET, name: 'Rosa Delgado' });
    expect(state).toMatchObject({ status: 'error', message: 'That person is not in this camp.' });
    expect(h.users.renameMember).not.toHaveBeenCalled();
  });

  it('an invalid name is refused before anything is written', async () => {
    const state = await renameMemberAction({ userId: TARGET, name: '' });
    expect(state).toMatchObject({ status: 'error' });
    expect(h.users.renameMember).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from '@buxa/domain';
import { setMemberOptionAction } from '../setMemberOptionAction';

const TEACHER = '6f1d2c3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' | 'teacher' },
  users: { roleIn: vi.fn(), setMemberOption: vi.fn() },
  revalidatePath: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ repositories: { users: h.users } }) }));
vi.mock('../../people/camp', () => ({ currentActor: () => settle(() => h.actor) }));

describe('setMemberOptionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'admin' };
    h.users.roleIn.mockResolvedValue('teacher');
    h.users.setMemberOption.mockResolvedValue(undefined);
  });

  it('an admin turns check-in and check-out on for a teacher, and the write is audited against the admin', async () => {
    const state = await setMemberOptionAction({ userId: TEACHER, option: 'teacher.check_in_out', enabled: true });
    expect(state).toEqual({ status: 'success', message: 'Saved' });
    expect(h.users.setMemberOption).toHaveBeenCalledWith(h.actor, TEACHER, 'teacher.check_in_out', true);
    expect(h.revalidatePath).toHaveBeenCalled();
  });

  it('an owner may set it too', async () => {
    h.actor = { userId: 'u1', orgId: 'o1', role: 'owner' };
    const state = await setMemberOptionAction({ userId: TEACHER, option: 'teacher.check_in_out', enabled: false });
    expect(state.status).toBe('success');
    expect(h.users.setMemberOption).toHaveBeenCalledWith(h.actor, TEACHER, 'teacher.check_in_out', false);
  });

  it('staff cannot set it, and nothing is written', async () => {
    h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
    const state = await setMemberOptionAction({ userId: TEACHER, option: 'teacher.check_in_out', enabled: true });
    expect(state).toMatchObject({ status: 'error', message: 'You cannot change this person’s options.' });
    expect(h.users.setMemberOption).not.toHaveBeenCalled();
  });

  it('an option can be set only on a teacher', async () => {
    h.users.roleIn.mockResolvedValueOnce('staff');
    const state = await setMemberOptionAction({ userId: TEACHER, option: 'teacher.check_in_out', enabled: true });
    expect(state).toMatchObject({ status: 'error', message: 'Only a teacher can have this option.' });
    expect(h.users.setMemberOption).not.toHaveBeenCalled();
  });

  it('an unknown option, a person outside the camp and an invalid id are refused before anything is written', async () => {
    expect(await setMemberOptionAction({ userId: TEACHER, option: 'teacher.fly', enabled: true })).toMatchObject({
      status: 'error',
    });
    h.users.roleIn.mockResolvedValueOnce(null);
    expect(
      await setMemberOptionAction({ userId: TEACHER, option: 'teacher.check_in_out', enabled: true }),
    ).toMatchObject({ status: 'error', message: 'That person is not in this camp.' });
    expect(
      await setMemberOptionAction({ userId: 'not-a-uuid', option: 'teacher.check_in_out', enabled: true }),
    ).toMatchObject({ status: 'error' });
    expect(h.users.setMemberOption).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classPath } from '@buxa/shared/config/routes';
import { idle } from '@buxa/shared';
import { forbidden } from '../../../http/errors';
import { createClassAction } from '../createClassAction';
import { formOf } from './form';
import { settle } from '@buxa/domain';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  classes: { createClass: vi.fn() },
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: { classes: h.classes } }) }));
vi.mock('../../people/camp', () => ({ currentActor: () => settle(() => h.actor) }));

const CLASS_ID = '44444444-4444-4444-8444-444444444444';
const valid = { name: 'Robotics', description: 'Build robots.', minAge: '8', maxAge: '12', capacity: '12', ratioInstructors: '', ratioCampers: '' };

describe('createClassAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
    h.redirect.mockImplementation((to: string) => {
      throw new Error(`NEXT_REDIRECT ${to}`);
    });
    h.classes.createClass.mockResolvedValue({ ok: true, value: { id: CLASS_ID } });
  });

  it('creates the class and opens its page', async () => {
    await expect(createClassAction(idle, formOf(valid))).rejects.toThrow(`NEXT_REDIRECT ${classPath(CLASS_ID)}`);
    expect(h.classes.createClass).toHaveBeenCalledWith(h.actor, expect.objectContaining({ name: 'Robotics', ageRange: { minAge: 8, maxAge: 12 } }));
    expect(h.revalidatePath).toHaveBeenCalled();
  });

  it('answers a blank name and missing ages with field errors, and creates nothing', async () => {
    const state = await createClassAction(idle, formOf({ ...valid, name: '', minAge: '' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { name: 'Give the class a name.', minAge: 'Enter the youngest age.' } });
    expect(h.classes.createClass).not.toHaveBeenCalled();
  });

  it('shows the service\'s message when the service refuses (a role that may not manage classes)', async () => {
    h.classes.createClass.mockRejectedValue(forbidden('nope'));
    expect(await createClassAction(idle, formOf(valid))).toEqual({ status: 'error', message: 'Your role cannot do this.', fieldErrors: undefined });
  });

  it('asks the person to choose a camp when there is none', async () => {
    h.actor = null;
    expect(await createClassAction(idle, formOf(valid))).toMatchObject({ status: 'error', message: 'Choose a camp first.' });
    expect(h.classes.createClass).not.toHaveBeenCalled();
  });
});

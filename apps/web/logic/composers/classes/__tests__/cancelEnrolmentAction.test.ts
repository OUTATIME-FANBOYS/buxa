import { beforeEach, describe, expect, it, vi } from 'vitest';
import { idle } from '@/logic/common';
import { forbidden } from '@/server/http/errors';
import { cancelEnrolmentAction } from '../cancelEnrolmentAction';
import { formOf, IDS } from './form';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  classes: { cancelEnrolment: vi.fn() },
  revalidatePath: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services: { classes: h.classes } }) }));
vi.mock('@/logic/composers/people/camp', () => ({ currentActor: async () => h.actor }));

describe('cancelEnrolmentAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
    h.classes.cancelEnrolment.mockResolvedValue({ ok: true, value: {} });
  });

  it('cancels the enrolment, and says the place is free', async () => {
    const state = await cancelEnrolmentAction(idle, formOf({ classId: IDS.cls, enrolmentId: IDS.enrolment }));
    expect(state).toEqual({ status: 'success', message: 'Enrolment cancelled. The place is free.' });
    expect(h.classes.cancelEnrolment).toHaveBeenCalledWith(h.actor, { enrolmentId: IDS.enrolment });
    expect(h.revalidatePath).toHaveBeenCalled();
  });

  it('tells the person when the enrolment is already gone', async () => {
    h.classes.cancelEnrolment.mockResolvedValue({ ok: false, failure: { reason: 'enrolment_not_found', message: 'That enrolment does not exist, or it is already cancelled.' } });
    expect(await cancelEnrolmentAction(idle, formOf({ classId: IDS.cls, enrolmentId: IDS.enrolment })))
      .toEqual({ status: 'error', message: 'That enrolment does not exist, or it is already cancelled.' });
  });

  it('answers a role that may not manage classes with the forbidden message', async () => {
    h.classes.cancelEnrolment.mockRejectedValue(forbidden('nope'));
    expect(await cancelEnrolmentAction(idle, formOf({ classId: IDS.cls, enrolmentId: IDS.enrolment })))
      .toEqual({ status: 'error', message: 'Your role cannot do this.', fieldErrors: undefined });
  });

  it('refuses a missing enrolment id without calling the service', async () => {
    expect(await cancelEnrolmentAction(idle, formOf({ classId: IDS.cls, enrolmentId: '' }))).toMatchObject({ status: 'error' });
    expect(h.classes.cancelEnrolment).not.toHaveBeenCalled();
  });
});

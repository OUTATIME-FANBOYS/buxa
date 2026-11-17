import { beforeEach, describe, expect, it, vi } from 'vitest';
import { idle } from '@buxa/shared';
import { forbidden } from '@/server/http/errors';
import { enrolAction } from '../enrolAction';
import { formOf, IDS } from './form';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  classes: { enrol: vi.fn() },
  revalidatePath: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services: { classes: h.classes } }) }));
vi.mock('@/logic/composers/people/camp', () => ({ currentActor: async () => h.actor }));

const base = { classId: IDS.cls, sessionId: IDS.session, camperId: IDS.camper };
const enrolled = { id: IDS.enrolment, sessionId: IDS.session, classId: IDS.cls, className: 'Robotics', camperId: IDS.camper, camperName: 'Ada Lovelace', status: 'enrolled', enrolledAt: '2027-07-01T00:00:00.000Z', overrideReason: null };

describe('enrolAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
    h.classes.enrol.mockResolvedValue({ ok: true, value: enrolled });
  });

  it('enrols the camper and says so', async () => {
    expect(await enrolAction(idle, formOf({ ...base, intent: 'enrol' }))).toEqual({ status: 'success', message: 'Ada Lovelace is enrolled.' });
    expect(h.classes.enrol).toHaveBeenCalledWith(h.actor, { sessionId: IDS.session, camperId: IDS.camper, waitlistIfFull: false });
    expect(h.revalidatePath).toHaveBeenCalled();
  });

  it('puts the camper on the waitlist when the waitlist button is pressed', async () => {
    h.classes.enrol.mockResolvedValue({ ok: true, value: { ...enrolled, status: 'waitlisted' } });
    expect(await enrolAction(idle, formOf({ ...base, intent: 'waitlist' }))).toEqual({ status: 'success', message: 'Ada Lovelace is on the waitlist for this session.' });
    expect(h.classes.enrol).toHaveBeenCalledWith(h.actor, expect.objectContaining({ waitlistIfFull: true }));
  });

  it('passes a clash on as the refusal message, which names the other session', async () => {
    const message = 'This clashes with Art (Mon 5 Jul, 10:00-12:00), which the camper is already enrolled in.';
    h.classes.enrol.mockResolvedValue({ ok: false, failure: { reason: 'overlap', message } });
    expect(await enrolAction(idle, formOf({ ...base, intent: 'enrol' }))).toEqual({ status: 'error', message });
  });

  it('sends an admin\'s override reason with the enrolment', async () => {
    h.actor = { userId: 'u1', orgId: 'o1', role: 'admin' };
    await enrolAction(idle, formOf({ ...base, intent: 'enrol', overrideReason: 'Sibling pickup' }));
    expect(h.classes.enrol).toHaveBeenCalledWith(h.actor, expect.objectContaining({ override: { reason: 'Sibling pickup' } }));
  });

  it('answers a role that may not enrol with the forbidden message', async () => {
    h.classes.enrol.mockRejectedValue(forbidden('nope'));
    expect(await enrolAction(idle, formOf({ ...base, intent: 'enrol' }))).toEqual({ status: 'error', message: 'Your role cannot do this.', fieldErrors: undefined });
  });

  it('asks for a camper, and does not call the service without one', async () => {
    expect(await enrolAction(idle, formOf({ ...base, camperId: '', intent: 'enrol' }))).toMatchObject({ status: 'error', fieldErrors: { camperId: 'Choose a camper.' } });
    expect(h.classes.enrol).not.toHaveBeenCalled();
  });
});

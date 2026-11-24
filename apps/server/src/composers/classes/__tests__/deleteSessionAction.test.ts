import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from '@buxa/domain';
import { idle } from '@buxa/shared';
import { deleteSessionAction } from '../deleteSessionAction';
import { formOf, IDS } from './form';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  classes: {
    getSession: vi.fn(),
    deleteSession: vi.fn(),
  },
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: { classes: h.classes } }) }));
vi.mock('../../people/camp', () => ({ currentActor: () => settle(() => h.actor) }));

const ADMIN = { userId: 'user-admin', orgId: 'org-1', role: 'admin' as const };

describe('deleteSessionAction', () => {
  beforeEach(() => {
    h.actor = ADMIN;
    h.classes.getSession.mockReset();
    h.classes.deleteSession.mockReset();
    h.revalidatePath.mockClear();
    h.redirect.mockClear();
  });

  it('deletes the session and redirects to the list with its name in ?deleted=', async () => {
    h.classes.getSession.mockResolvedValue({ ok: true, value: { id: IDS.session, name: 'Summer camp' } });
    h.classes.deleteSession.mockResolvedValue({ ok: true, value: null });

    await deleteSessionAction(idle, formOf({ sessionId: IDS.session }));

    expect(h.classes.deleteSession).toHaveBeenCalledWith(ADMIN, IDS.session);
    expect(h.redirect).toHaveBeenCalledWith('/camp/sessions?deleted=Summer%20camp');
    expect(h.revalidatePath).toHaveBeenCalledWith('/camp/sessions');
  });

  it('trims the name and cuts it to 120 characters before it goes in the URL', async () => {
    const long = `  ${'a'.repeat(130)}  `;
    h.classes.getSession.mockResolvedValue({ ok: true, value: { id: IDS.session, name: long } });
    h.classes.deleteSession.mockResolvedValue({ ok: true, value: null });

    await deleteSessionAction(idle, formOf({ sessionId: IDS.session }));

    expect(h.redirect).toHaveBeenCalledWith(`/camp/sessions?deleted=${'a'.repeat(120)}`);
  });

  it('does not redirect when the session holds classes, and returns the refusal', async () => {
    h.classes.getSession.mockResolvedValue({ ok: true, value: { id: IDS.session, name: 'Art' } });
    h.classes.deleteSession.mockResolvedValue({
      ok: false,
      failure: {
        reason: 'session_has_classes',
        message:
          'This session has classes, so it cannot be deleted. Archive it, or delete its classes and the session.',
      },
    });

    const state = await deleteSessionAction(idle, formOf({ sessionId: IDS.session }));

    expect(state).toEqual({
      status: 'error',
      message: 'This session has classes, so it cannot be deleted. Archive it, or delete its classes and the session.',
      fieldErrors: undefined,
    });
    expect(h.redirect).not.toHaveBeenCalled();
  });
});

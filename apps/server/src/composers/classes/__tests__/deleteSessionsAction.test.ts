import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settle, type Actor } from '@buxa/domain';
import type { ClassService } from '../../../classes/ClassService';
import { as, JULY_SESSION, monday9to12, robotics, setup } from '../../../classes/__tests__/fixtures';
import { deleteSessionsAction } from '../deleteSessionsAction';
import { formOf } from './form';

const h = vi.hoisted(() => ({
  actor: null as Actor | null,
  classes: null as ClassService | null,
  revalidatePath: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: { classes: h.classes } }) }));
vi.mock('../../people/camp', () => ({ currentActor: () => settle(() => h.actor) }));

const NO_SESSION = '99999999-9999-4999-8999-999999999999';

/** Two sessions in the camp: "Music" (empty, deletable) and "Art" (holds a class, refused). */
async function twoSessions() {
  const { service, repo } = setup();
  const music = await service.createSession(as('admin'), { ...JULY_SESSION, name: 'Music' });
  const art = await service.createSession(as('admin'), { ...JULY_SESSION, name: 'Art' });
  if (!music.ok || !art.ok) {
    throw new Error('setup failed');
  }
  const added = await service.addClass(as('admin'), art.value.id, { ...robotics, ...monday9to12 });
  if (!added.ok) {
    throw new Error(added.failure.message);
  }
  h.classes = service;

  return { service, repo, musicId: music.value.id, artId: art.value.id };
}

describe('deleteSessionsAction', () => {
  beforeEach(() => {
    h.actor = as('admin');
    h.revalidatePath.mockClear();
  });

  it('deletes the empty session and refuses the one with a class, and does not stop at the refusal', async () => {
    const { service, repo, musicId, artId } = await twoSessions();

    // The refused session comes first, so a stop-at-first-refusal would leave Music in place.
    const result = await deleteSessionsAction({ status: 'idle' }, formOf({ sessionId: [artId, musicId] }));

    expect(result).toEqual({
      status: 'done',
      deleted: [{ id: musicId, name: 'Music' }],
      refused: [
        {
          id: artId,
          name: 'Art',
          code: 'session_has_classes',
          reason:
            'This session has classes, so it cannot be deleted. Archive it, or delete its classes and the session.',
        },
      ],
    });
    const left = await service.listSessions(as('admin'));
    expect(left.ok && left.value.map(s => s.name)).toEqual(['Art']);
    const deletes = repo.audit.filter(a => a.action === 'session.delete');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toMatchObject({ entityId: musicId, data: { name: 'Music' } });
    expect(h.revalidatePath).toHaveBeenCalledWith('/camp/sessions');
  });

  it('refuses a viewer with nothing deleted', async () => {
    const { service, musicId } = await twoSessions();
    h.actor = as('viewer');

    const result = await deleteSessionsAction({ status: 'idle' }, formOf({ sessionId: [musicId] }));

    expect(result.status).toBe('error');
    const still = await service.getSession(as('admin'), musicId);
    expect(still.ok).toBe(true);
  });

  it('treats a session the camp does not have as refused, and says it is already gone', async () => {
    await twoSessions();
    const result = await deleteSessionsAction({ status: 'idle' }, formOf({ sessionId: [NO_SESSION] }));

    expect(result).toMatchObject({
      status: 'done',
      deleted: [],
      refused: [{ id: NO_SESSION, name: 'A session', code: 'session_not_found' }],
    });
  });

  it('refuses more than 100 sessions, and deletes none', async () => {
    const { service, musicId } = await twoSessions();
    const ids = Array.from({ length: 101 }, () => crypto.randomUUID());

    const result = await deleteSessionsAction({ status: 'idle' }, formOf({ sessionId: [...ids, musicId] }));

    expect(result).toEqual({ status: 'error', message: 'Choose up to 100 sessions to delete.' });
    expect((await service.getSession(as('admin'), musicId)).ok).toBe(true);
  });

  it('refuses an id that is not a UUID', async () => {
    const { musicId } = await twoSessions();
    const result = await deleteSessionsAction({ status: 'idle' }, formOf({ sessionId: ['not-a-uuid', musicId] }));
    expect(result.status).toBe('error');
  });

  it('deletes a repeated id once', async () => {
    const { musicId } = await twoSessions();
    const result = await deleteSessionsAction({ status: 'idle' }, formOf({ sessionId: [musicId, musicId] }));
    expect(result).toMatchObject({ status: 'done', deleted: [{ id: musicId }], refused: [] });
  });
});

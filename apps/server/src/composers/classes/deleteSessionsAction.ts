'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isUuid } from '@buxa/domain';
import { ROUTES } from '@buxa/shared/config/routes';
import { fieldAll, type DeletedSession, type RefusedSession, type SessionDeletion } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

export const MAX_SESSION_DELETES = 100;
const SELECTION_INVALID = `Choose up to ${MAX_SESSION_DELETES} sessions to delete.`;
const NAME_FALLBACK = 'A session';

const sessionIds = z.array(z.string().refine(isUuid)).min(1).max(MAX_SESSION_DELETES);

/**
 * Delete the selected sessions, one at a time, in the actor's camp. A session that holds classes is refused with its reason and the
 * rest still go: the action does not stop at the first refusal. Each deletion writes its own audit entry (in the service). The list
 * is revalidated when anything was deleted. classes:manage is checked by the service; a viewer gets the forbidden message.
 */
export async function deleteSessionsAction(_previous: SessionDeletion, form: FormData): Promise<SessionDeletion> {
  const actor = await currentActor();
  if (!actor) {
    return { status: 'error', message: NO_CAMP };
  }

  const parsed = sessionIds.safeParse(Array.from(new Set(fieldAll(form, 'sessionId'))));
  if (!parsed.success) {
    return { status: 'error', message: SELECTION_INVALID };
  }

  try {
    const services = getRuntime().services.classes;
    const listed = await services.listSessions(actor);
    if (!listed.ok) {
      return { status: 'error', message: listed.failure.message };
    }
    const names = new Map(listed.value.map(session => [session.id, session.name]));

    const deleted: DeletedSession[] = [];
    const refused: RefusedSession[] = [];
    for (const id of parsed.data) {
      const name = names.get(id) ?? NAME_FALLBACK;
      const outcome = await services.deleteSession(actor, id);
      if (outcome.ok) {
        deleted.push({ id, name });
      } else {
        refused.push({ id, name, code: outcome.failure.reason, reason: outcome.failure.message });
      }
    }

    if (deleted.length > 0) {
      revalidatePath(ROUTES.sessions);
    }

    return { status: 'done', deleted, refused };
  } catch (error) {
    const state = expectedFailure(error, 'Could not delete the sessions.');

    return { status: 'error', message: state.status === 'error' ? state.message : 'Could not delete the sessions.' };
  }
}

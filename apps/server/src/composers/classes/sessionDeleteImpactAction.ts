'use server';

import { isUuid } from '@buxa/domain';
import type { SessionDeleteImpact } from '@buxa/contracts';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

export type SessionDeleteImpactResult = { ok: true; impact: SessionDeleteImpact } | { ok: false; message: string };

/**
 * What deleting a draft session would remove, so the confirmation can list it before the person types the name. Read only. Needs
 * classes:delete_with_classes (admin and owner).
 */
export async function sessionDeleteImpactAction(sessionId: string): Promise<SessionDeleteImpactResult> {
  const actor = await currentActor();
  if (!actor) {
    return { ok: false, message: NO_CAMP };
  }
  if (!isUuid(sessionId)) {
    return { ok: false, message: 'That session no longer exists.' };
  }
  try {
    const outcome = await getRuntime().services.classes.sessionDeleteImpact(actor, sessionId);

    return outcome.ok ? { ok: true, impact: outcome.value } : { ok: false, message: outcome.failure.message };
  } catch (error) {
    const state = expectedFailure(error, 'Could not read what the session holds.');

    return { ok: false, message: state.status === 'error' ? state.message : 'Could not read what the session holds.' };
  }
}

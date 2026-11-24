'use server';

import { isUuid } from '@buxa/domain';
import { field, sessionEditForm, type SessionDatesPreviewState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

const FALLBACK = 'Could not check the dates.';

/**
 * Checks a session's new dates before the Edit session dialog saves them: which classes would be flagged, and which would refuse the
 * save. Reads only. The service checks classes:manage. The form is the same one the save reads.
 */
export async function previewSessionDatesAction(form: FormData): Promise<SessionDatesPreviewState> {
  const actor = await currentActor();
  if (!actor) {
    return { ok: false, message: NO_CAMP };
  }
  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return { ok: false, message: 'That session no longer exists.' };
  }
  const parsed = sessionEditForm(form);
  if (!parsed.ok) {
    // Nothing can be flagged until the form is valid. The save reports the field errors, so the dialog goes on to it.
    return { ok: true, outside: [], blocked: [] };
  }

  try {
    const outcome = await getRuntime().services.classes.previewSessionDates(actor, sessionId, parsed.data);
    if (!outcome.ok) {
      return { ok: false, message: outcome.failure.message };
    }

    return {
      ok: true,
      outside: outcome.value.outside.map(c => c.name),
      blocked: outcome.value.blocked.map(c => c.name),
    };
  } catch (error) {
    const state = expectedFailure(error, FALLBACK);

    return { ok: false, message: state.status === 'error' ? state.message : FALLBACK };
  }
}

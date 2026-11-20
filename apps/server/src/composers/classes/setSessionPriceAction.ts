'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { ROUTES, sessionPath } from '@buxa/shared/config/routes';
import { failure, field, sessionPriceForm, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Set or clear a session's price (the Price dialog on the session page). Shown for information only: nothing is charged. The
 * service checks classes:manage before anything is written, so a viewer who posts this form is refused and the price is unchanged.
 * The amount is parsed to minor units with the currency's places; the server validates again through the contract.
 */
export async function setSessionPriceAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }

  const parsed = sessionPriceForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    const outcome = await getRuntime().services.classes.setSessionPrice(actor, sessionId, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not save the price.');
  }

  revalidatePath(ROUTES.sessions);
  revalidatePath(sessionPath(sessionId));

  return success('Price saved.');
}

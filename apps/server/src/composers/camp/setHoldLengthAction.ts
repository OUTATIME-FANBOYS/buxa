'use server';

import { revalidatePath } from 'next/cache';
import { HoldLengthInputSchema } from '@buxa/contracts';
import { ROUTES } from '@buxa/shared/config/routes';
import { failure, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { isHttpError } from '../../http/errors';
import { requireSession, toActor } from '../../session';
import { expectedCampFailure, membershipOf } from './failures';
import { parseInput, text } from '@buxa/shared';

/**
 * Sets how long a seat hold lasts for a camp (org:update: owner and admin). An empty field puts the camp back to the default.
 * The camp id comes from the form but is checked against the person's memberships. Holds already placed keep their time.
 */
export async function setHoldLengthAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession();
  const camp = membershipOf(session, text(form, 'campId'));
  if (!camp) {
    return failure('You are not a member of that camp.');
  }
  const parsed = parseInput(HoldLengthInputSchema, { holdMinutes: text(form, 'holdMinutes') });
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    await getRuntime().services.orgs.setHoldLength(toActor(session, camp), parsed.data);
  } catch (error) {
    // A refused length (400) carries its own polite message; other expected failures use the camp's shared wording.
    if (isHttpError(error) && error.statusCode === 400) {
      return failure(error.message, { holdMinutes: error.message });
    }

    return expectedCampFailure(error, 'Could not save the seat hold length.');
  }

  revalidatePath(ROUTES.camp, 'layout');

  return success('Seat hold length saved');
}

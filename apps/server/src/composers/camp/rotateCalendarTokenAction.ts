'use server';

import { currentActor } from '../people/camp';
import { getRuntime } from '../../runtime';

/** The result of rotating the calendar link: the new token, shown once, or why it could not be made. */
export type RotateCalendarTokenResult = { ok: true; token: string } | { ok: false; message: string };

/**
 * Make a new iCal feed link for the camp. The old link stops working at once. The token is returned to the admin who asked and
 * is not stored anywhere in plain form (only its hash is kept), so it has to be copied now. The service checks org:update.
 */
export async function rotateCalendarTokenAction(): Promise<RotateCalendarTokenResult> {
  const actor = await currentActor();
  if (!actor) {
    return { ok: false, message: 'Choose a camp first.' };
  }

  try {
    const token = await getRuntime().services.calendar.rotateToken(actor);

    return { ok: true, token };
  } catch {
    return { ok: false, message: 'Could not make a new calendar link. Try again.' };
  }
}

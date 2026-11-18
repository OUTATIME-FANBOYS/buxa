'use server';

import { revalidatePath } from 'next/cache';
import { TimeFormatInputSchema } from '@buxa/contracts';
import { ROUTES } from '@buxa/shared/config/routes';
import { failure, parseInput, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { requireSession } from '../../session';

/**
 * Saves the signed-in person's own 12-hour or 24-hour clock. One action serves both the account menu and Settings. The id always
 * comes from the session, so a person can only change their own clock. The camp area is re-rendered so the choice shows at once.
 */
export async function updateTimeFormatAction(input: { clockFormat: string }): Promise<ActionState> {
  const session = await requireSession();
  const parsed = parseInput(TimeFormatInputSchema, { clockFormat: input.clockFormat ?? '' });
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    await getRuntime().repositories.users.setClockFormat(session.user.id, parsed.data.clockFormat);
  } catch {
    return failure('Could not save your time format. Try again.');
  }

  revalidatePath(ROUTES.camp, 'layout');

  return success('Time format saved');
}

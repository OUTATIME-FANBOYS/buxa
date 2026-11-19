'use server';

import { revalidatePath } from 'next/cache';
import { ProfileInputSchema } from '@buxa/contracts';
import { ROUTES } from '@buxa/shared/config/routes';
import { failure, parseInput, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { requireSession } from '../../session';

/**
 * Saves the signed-in person's own first and last name to their account (the full name is rebuilt from them). The id always comes from the session, never from the input, so a
 * person can only ever change their own name. The camp area is re-rendered, so the greeting, the account menu and the team list
 * show the saved name straight away.
 */
export async function updateProfileAction(input: { firstName: string; lastName?: string }): Promise<ActionState> {
  const session = await requireSession();
  const parsed = parseInput(ProfileInputSchema, { firstName: input.firstName ?? '', lastName: input.lastName ?? '' });
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    await getRuntime().repositories.users.updateName(session.user.id, parsed.data);
  } catch {
    return failure('Could not save your name. Try again.');
  }

  revalidatePath(ROUTES.camp, 'layout');

  return success('Profile saved');
}

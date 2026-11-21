'use server';

import { revalidatePath } from 'next/cache';
import { ChangeMemberRoleInputSchema } from '@buxa/contracts';
import { ROUTES } from '@buxa/shared/config/routes';
import { failure, parseInput, success, text, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { findCampContext } from './campContext';
import { expectedCampFailure } from './failures';

/**
 * Manage access: give one member a different permission role in the camp the person is working in. The service checks
 * members:change_role and the rules that keep the camp safe (no self change, only an owner makes an owner, one owner stays).
 */
export async function changeMemberRoleAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const context = await findCampContext();
  if (!context) {
    return failure('Choose a camp first.');
  }
  const parsed = parseInput(ChangeMemberRoleInputSchema, {
    userId: text(form, 'userId'),
    role: text(form, 'role'),
  });
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    await getRuntime().services.orgs.changeMemberRole(context.actor, parsed.data);
  } catch (error) {
    return expectedCampFailure(error, 'Could not change the role.');
  }

  revalidatePath(ROUTES.members);

  return success('Role changed.');
}

'use server';

import { revalidatePath } from 'next/cache';
import { ProfileNameInputSchema } from '@buxa/contracts';
import { authorize, isUuid } from '@buxa/domain';
import { ROUTES } from '@buxa/shared/config/routes';
import { failure, parseInput, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';

/**
 * Renames another person in the camp. Needs members:rename: an admin or owner, and only someone strictly below them.
 * Your own name is changed from your profile instead. The rank check runs here, before anything is written.
 */
export async function renameMemberAction(input: { userId: string; name: string }): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure('Choose a camp first.');
  }
  if (!isUuid(input.userId)) {
    return failure('That person is not valid.');
  }
  const parsed = parseInput(ProfileNameInputSchema, { name: input.name ?? '' });
  if (!parsed.ok) {
    return parsed.state;
  }

  const repos = getRuntime().repositories.users;
  const role = await repos.roleIn(actor.userId, actor.orgId, input.userId);
  if (!role) {
    return failure('That person is not in this camp.');
  }
  const decision = authorize(actor, 'members:rename', {
    orgId: actor.orgId,
    target: { userId: input.userId, role },
  });
  if (!decision.allow) {
    return failure('You cannot rename this person.');
  }

  try {
    const renamed = await repos.renameMember(actor, input.userId, parsed.data.name);
    if (!renamed) {
      return failure('That person is not in this camp.');
    }
  } catch {
    return failure('Could not rename this person. Try again.');
  }

  revalidatePath(ROUTES.camp, 'layout');

  return success('Name saved');
}

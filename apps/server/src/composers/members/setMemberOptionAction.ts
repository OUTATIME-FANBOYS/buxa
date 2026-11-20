'use server';

import { revalidatePath } from 'next/cache';
import { MEMBER_OPTIONS, authorize, isUuid } from '@buxa/domain';
import { ROUTES } from '@buxa/shared/config/routes';
import { failure, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';

/**
 * Turns a per-person option on or off for a teacher. Needs members:set_options: an admin or owner, and a target who is a teacher
 * and strictly below them. The rule check runs here, before anything is written; the database refuses a non-teacher as well.
 */
export async function setMemberOptionAction(input: {
  userId: string;
  option: string;
  enabled: boolean;
}): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure('Choose a camp first.');
  }
  if (!isUuid(input.userId)) {
    return failure('That person is not valid.');
  }
  const option = MEMBER_OPTIONS.find(o => o === input.option);
  if (!option || typeof input.enabled !== 'boolean') {
    return failure('That option does not exist.');
  }

  const repos = getRuntime().repositories.users;
  const role = await repos.roleIn(actor.userId, actor.orgId, input.userId);
  if (!role) {
    return failure('That person is not in this camp.');
  }
  const decision = authorize(actor, 'members:set_options', {
    orgId: actor.orgId,
    target: { userId: input.userId, role },
    option,
  });
  if (!decision.allow) {
    return failure(
      decision.reason === 'option_not_for_role'
        ? 'Only a teacher can have this option.'
        : 'You cannot change this person’s options.',
    );
  }

  try {
    await repos.setMemberOption(actor, input.userId, option, input.enabled);
  } catch {
    return failure('Could not save the option. Try again.');
  }

  revalidatePath(ROUTES.camp, 'layout');

  return success('Saved');
}

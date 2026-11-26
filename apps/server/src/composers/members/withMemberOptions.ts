import { isTeachingView, type Actor } from '@buxa/domain';
import { getRuntime } from '../../runtime';

/**
 * The actor with its teaching flag and options attached. Only a viewer can be in the teaching view, so any other access level is
 * returned unchanged and costs no read. authorize() reads both from the actor; this is the one place they are loaded for a request.
 */
export async function withMemberOptions(actor: Actor): Promise<Actor>;
export async function withMemberOptions(actor: Actor | null): Promise<Actor | null>;
export async function withMemberOptions(actor: Actor | null): Promise<Actor | null> {
  if (!actor || actor.role !== 'viewer') {
    return actor;
  }
  const users = getRuntime().repositories.users;
  const instructor = await users.isInstructorIn(actor.userId, actor.orgId, actor.userId);
  const withTeaching = { ...actor, instructor };
  if (!isTeachingView(withTeaching)) {
    return withTeaching;
  }
  const options = await users.memberOptionsOf(actor.userId, actor.orgId, actor.userId);

  return { ...withTeaching, options };
}

/** Whether the actor is in the teaching view (for the sidebar). False with no actor, so a visitor without a camp sees none of it. */
export async function teachingViewOf(actor: Actor | null): Promise<boolean> {
  return actor !== null && isTeachingView(await withMemberOptions(actor));
}

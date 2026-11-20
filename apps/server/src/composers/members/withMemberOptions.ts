import type { Actor } from '@buxa/domain';
import { getRuntime } from '../../runtime';

/**
 * The actor with its options attached. Only a teacher holds options (MEMBER_OPTIONS), so any other role is returned unchanged
 * and costs no read. authorize() reads the options from the actor; this is the one place they are loaded for a request.
 */
export async function withMemberOptions(actor: Actor): Promise<Actor>;
export async function withMemberOptions(actor: Actor | null): Promise<Actor | null>;
export async function withMemberOptions(actor: Actor | null): Promise<Actor | null> {
  if (!actor || actor.role !== 'teacher') {
    return actor;
  }
  const options = await getRuntime().repositories.users.memberOptionsOf(actor.userId, actor.orgId, actor.userId);

  return { ...actor, options };
}

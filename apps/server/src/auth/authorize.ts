import { authorize, type Action, type Actor, type Resource } from '@buxa/domain';
import { forbidden } from '../http/errors';

/** What a person sees when they try to change something in an archived camp. */
export const ARCHIVED_CAMP_MESSAGE = 'This camp is archived. You can view it, but nothing in it can be changed.';

/**
 * The permission check every service starts with. Throws a 403 the client can show; the reason stays server-side, except that an
 * archived camp says so, because the person can see the banner and needs to know why nothing changes.
 */
export function assertAllowed(actor: Actor, action: Action, resource?: Resource): void {
  const decision = authorize(actor, action, resource);
  if (decision.allow) {
    return;
  }

  throw forbidden(decision.reason === 'archived_camp' ? ARCHIVED_CAMP_MESSAGE : 'Your role cannot do this');
}

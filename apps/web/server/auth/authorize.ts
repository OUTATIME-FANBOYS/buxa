import { authorize, type Action, type Actor, type Resource } from '@buxa/domain';
import { forbidden } from '../http/errors';

/** The permission check every service starts with. Throws a 403 the client can show; the reason stays server-side. */
export function assertAllowed(actor: Actor, action: Action, resource?: Resource): void {
  if (!authorize(actor, action, resource).allow) throw forbidden('Your role cannot do this');
}

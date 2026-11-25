import 'server-only';
import type { Person } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import { isHttpError } from '../../http/errors';
import { getRuntime } from '../../runtime';
import { requireSession } from '../../session';

/**
 * One person for the detail page, or null when the service says there is no such person in this camp (404). Other failures are thrown.
 * The signed-in user's email goes to the service, so a family's guardian sees the child's emergency contact.
 */
export async function loadPerson(actor: Actor, id: string): Promise<Person | null> {
  const session = await requireSession();
  try {
    return await getRuntime().services.people.get(actor, id, session.user.email);
  } catch (error) {
    if (isHttpError(error) && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

import 'server-only';
import type { Person } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import { isHttpError } from '@/server/http/errors';
import { getRuntime } from '@/server/runtime';

/** One person for the detail page, or null when the service says there is no such person in this camp (404). Other failures are thrown. */
export async function loadPerson(actor: Actor, id: string): Promise<Person | null> {
  try { return await getRuntime().services.people.get(actor, id); }
  catch (error) {
    if (isHttpError(error) && error.statusCode === 404) return null;
    throw error;
  }
}

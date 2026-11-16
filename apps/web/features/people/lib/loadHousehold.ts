import 'server-only';
import type { Household } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import { isHttpError } from '@/server/http/errors';
import { getRuntime } from '@/server/runtime';

/** A household, or null when it is not in this camp (404). Other failures are thrown. */
export async function loadHousehold(actor: Actor, id: string): Promise<Household | null> {
  try { return await getRuntime().services.people.getHousehold(actor, id); }
  catch (error) {
    if (isHttpError(error) && error.statusCode === 404) return null;
    throw error;
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { ROUTES } from '@buxa/shared/config/routes';
import { getRuntime } from '../../runtime';
import { currentActor } from './camp';
import { isHttpError } from '../../http/errors';

export interface PeopleDeletion {
  deleted: string[];
  /** Ids that were not deleted (not found, or refused by the owner rule). */
  refused: string[];
}

/** Delete one or more people (owner only). Each is a separate service call, so one refusal does not stop the rest. */
export async function deletePeopleAction(ids: readonly string[]): Promise<PeopleDeletion> {
  const actor = await currentActor();
  const result: PeopleDeletion = { deleted: [], refused: [] };
  if (!actor) {
    return { deleted: [], refused: [...ids] };
  }
  for (const id of ids) {
    if (!isUuid(id)) {
      result.refused.push(id);
      continue;
    }
    try {
      await getRuntime().services.people.erase(actor, id);
      result.deleted.push(id);
    } catch (error) {
      if (!isHttpError(error)) {
        throw error;
      }
      result.refused.push(id);
    }
  }
  revalidatePath(ROUTES.people);

  return result;
}

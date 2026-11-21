'use server';

import type { Person } from '@buxa/contracts';
import { isUuid } from '@buxa/domain';
import { currentActor } from './camp';
import { loadPerson } from './loadPerson';

/**
 * One person's full record for the Edit person pop-up, which opens from a row of the list (the list carries only a summary).
 * Null when the id is not a person in this camp, or the actor may not see them; the pop-up says so.
 */
export async function loadPersonAction(id: string): Promise<Person | null> {
  const actor = await currentActor();
  if (!actor || !isUuid(id)) {
    return null;
  }

  return loadPerson(actor, id);
}

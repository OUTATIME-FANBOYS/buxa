'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { failure, type ActionState } from '@/lib/actions/state';
import { getRuntime } from '@/server/runtime';
import { currentActor } from '../lib/camp';
import { expectedFailure, NO_CAMP } from './failures';

/**
 * Archive a person: hidden from search, their badge is revoked. Checked-in people cannot be archived (the service answers 409 and
 * the reason is shown). Needs people:delete. Success leaves the page for the list.
 */
export async function archivePersonAction(personId: string): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) return failure(NO_CAMP);
  if (!isUuid(personId)) return failure('That person is not valid.');

  try { await getRuntime().services.people.archive(actor, personId); }
  catch (error) { return expectedFailure(error, 'Could not archive this person.'); }

  revalidatePath(ROUTES.people);
  redirect(ROUTES.people); // throws; kept outside the try
}

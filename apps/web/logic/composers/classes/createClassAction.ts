'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ROUTES, classPath } from '@/config/routes';
import { failure, type ActionState } from '@/logic/common';
import { getRuntime } from '@/server/runtime';
import { currentActor } from '@/logic/composers/people/camp';
import { expectedFailure, NO_CAMP } from '@/logic/composers/people/failures';
import { classForm } from '@/logic/common';

/**
 * Create a class. Success opens the class page; a refused or invalid form comes back as form state. The service checks the permission
 * (classes:manage) before anything else, so a viewer who posts this form gets the forbidden message and nothing is written.
 */
export async function createClassAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) return failure(NO_CAMP);

  const parsed = classForm(form);
  if (!parsed.ok) return parsed.state;

  let createdId: string;
  try {
    const outcome = await getRuntime().services.classes.createClass(actor, parsed.data);
    if (!outcome.ok) return failure(outcome.failure.message);
    createdId = outcome.value.id;
  } catch (error) { return expectedFailure(error, 'Could not create the class.'); }

  revalidatePath(ROUTES.classes);
  redirect(classPath(createdId)); // throws; kept outside the try
}

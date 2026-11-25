'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { registrationFormPath, ROUTES } from '@buxa/shared/config/routes';
import { failure, field, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { NO_CAMP } from '../people/failures';
import { registrationFailure } from './failures';

/*
 * The registration lifecycle actions: withdraw, archive, unarchive and delete. Each checks its permission in the service, so a role
 * without it is refused there. Withdraw releases the registration's holds and cancels its enrolments but keeps the record. Archive
 * hides it from lists and keeps it. Delete erases it and its answers for good (admin and owner only).
 */

type Lifecycle = 'withdraw' | 'archive' | 'unarchive' | 'erase';

const DONE: Record<Lifecycle, string> = {
  withdraw: 'Registration withdrawn. Its holds are released and its enrolments cancelled.',
  archive: 'Registration archived.',
  unarchive: 'Registration brought back.',
  erase: 'Registration deleted, with all its answers.',
};

const FALLBACK: Record<Lifecycle, string> = {
  withdraw: 'Could not withdraw the registration.',
  archive: 'Could not archive the registration.',
  unarchive: 'Could not bring the registration back.',
  erase: 'Could not delete the registration.',
};

async function run(form: FormData, which: Lifecycle): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const formId = field(form, 'formId');
  const registrationId = field(form, 'registrationId');
  if (!isUuid(registrationId)) {
    return failure('That registration no longer exists.');
  }

  try {
    await getRuntime().services.registration[which](actor, registrationId);
  } catch (error) {
    return registrationFailure(error, FALLBACK[which]);
  }

  revalidatePath(ROUTES.registration);
  if (isUuid(formId)) {
    revalidatePath(registrationFormPath(formId));
  }
  // Holds and enrolments change on withdraw and delete, so the session pages are stale too.
  revalidatePath(ROUTES.sessions, 'layout');

  return success(DONE[which]);
}

export async function withdrawRegistrationAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  return run(form, 'withdraw');
}

export async function archiveRegistrationAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  return run(form, 'archive');
}

export async function unarchiveRegistrationAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  return run(form, 'unarchive');
}

export async function deleteRegistrationAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  return run(form, 'erase');
}

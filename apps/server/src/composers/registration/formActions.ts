'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { registrationFormPath, ROUTES } from '@buxa/shared/config/routes';
import { failure, field, registrationFormForm, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { NO_CAMP } from '../people/failures';
import { registrationFailure } from './failures';
import { filesNamed } from './uploads';

/*
 * Create, edit and publish a registration form. Each one checks the form with the contract (through registrationFormForm), then calls
 * the service, which checks the permission again and validates the input on the server.
 */

/** Creates a form, then opens it. The new form starts as a draft; it takes registrations once it is published. */
export async function createFormAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const parsed = registrationFormForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  let id: string;
  try {
    id = (
      await getRuntime().services.registration.createForm(actor, parsed.data, await filesNamed(form, 'attachments'))
    ).id;
  } catch (error) {
    return registrationFailure(error, 'Could not create the form.');
  }

  revalidatePath(ROUTES.registration);
  // Posted from the New registration form pop-up (dialog=1): the pop-up closes and a toast says so, with no redirect.
  if (field(form, 'dialog') === '1') {
    return success('Registration form created.');
  }
  redirect(registrationFormPath(id));
}

/** Saves the draft of a form. The published version does not change until the form is published again. */
export async function updateFormAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const formId = field(form, 'formId');
  if (!isUuid(formId)) {
    return failure('That form no longer exists.');
  }
  const parsed = registrationFormForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    await getRuntime().services.registration.updateForm(
      actor,
      formId,
      parsed.data,
      await filesNamed(form, 'attachments'),
    );
  } catch (error) {
    return registrationFailure(error, 'Could not save the form.');
  }

  revalidatePath(registrationFormPath(formId));
  revalidatePath(ROUTES.registration);

  return success('Draft saved. Families still see the published version until you publish a new one.');
}

/** Publishes the draft as the next version. Registrations after this are checked against it. */
export async function publishFormAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const formId = field(form, 'formId');
  if (!isUuid(formId)) {
    return failure('That form no longer exists.');
  }

  let version: number | null;
  try {
    version = (await getRuntime().services.registration.publishForm(actor, formId)).publishedVersion;
  } catch (error) {
    return registrationFailure(error, 'Could not publish the form.');
  }

  revalidatePath(registrationFormPath(formId));
  revalidatePath(ROUTES.registration);

  return success(`Published as version ${version ?? 1}. Families can now register on it.`);
}

/** Removes one attachment from a form. The file is named by its id; the service checks the form and the file are in this camp. */
export async function removeFormFileAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const formId = field(form, 'formId');
  const fileId = field(form, 'fileId');
  try {
    await getRuntime().services.registration.removeFormFile(actor, formId, fileId);
  } catch (error) {
    return registrationFailure(error, 'Could not remove the file.');
  }

  revalidatePath(registrationFormPath(formId));

  return success('File removed.');
}

/**
 * Deletes a form that has no registrations. The service checks registration:manage and the no-registrations rule on the server; a
 * form with registrations is refused with its message and nothing is removed.
 */
export async function deleteFormAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const formId = field(form, 'formId');
  if (!isUuid(formId)) {
    return failure('That form no longer exists.');
  }

  try {
    await getRuntime().services.registration.deleteForm(actor, formId);
  } catch (error) {
    return registrationFailure(error, 'Could not delete the form.');
  }

  revalidatePath(ROUTES.registration);

  return success('Form deleted.');
}

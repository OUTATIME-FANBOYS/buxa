'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@buxa/domain';
import { sessionPath } from '@buxa/shared/config/routes';
import { failure, field, seriesEditForm, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/**
 * Saves a series' shared fields (name, ages, camp size, location, instructors, price) on every one of its days. A teacher on the
 * series sends its name only; the service keeps the other fields as saved and refuses any change to them.
 */
export async function updateSeriesAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const seriesId = field(form, 'seriesId');
  const sessionId = field(form, 'sessionId');
  if (!isUuid(seriesId) || !isUuid(sessionId)) {
    return failure('That class no longer exists.');
  }
  const parsed = seriesEditForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    const outcome = await getRuntime().services.classes.updateSeries(actor, seriesId, parsed.data);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not save the class.');
  }

  revalidatePath(sessionPath(sessionId));

  return success('Class saved.');
}

/** Deletes a series and every day of it. A series with an enrolment, a hold or a registration is refused, and nothing is deleted. */
export async function deleteSeriesAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const seriesId = field(form, 'seriesId');
  const sessionId = field(form, 'sessionId');
  if (!isUuid(seriesId) || !isUuid(sessionId)) {
    return failure('That class no longer exists.');
  }

  try {
    const outcome = await getRuntime().services.classes.deleteSeries(actor, seriesId);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not delete the class.');
  }

  revalidatePath(sessionPath(sessionId));

  return success('Class deleted.');
}

/** Cancels one day of a series, with the reason the person typed. The series and its other days are not changed. */
export async function cancelOccurrenceAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const occurrenceId = field(form, 'occurrenceId');
  const sessionId = field(form, 'sessionId');
  if (!isUuid(occurrenceId) || !isUuid(sessionId)) {
    return failure('That day no longer exists.');
  }

  try {
    const outcome = await getRuntime().services.classes.cancelOccurrence(actor, occurrenceId, field(form, 'reason'));
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not cancel that day.');
  }

  revalidatePath(sessionPath(sessionId));

  return success('Day cancelled.');
}

/** Restores a cancelled day. */
export async function restoreOccurrenceAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const occurrenceId = field(form, 'occurrenceId');
  const sessionId = field(form, 'sessionId');
  if (!isUuid(occurrenceId) || !isUuid(sessionId)) {
    return failure('That day no longer exists.');
  }

  try {
    const outcome = await getRuntime().services.classes.restoreOccurrence(actor, occurrenceId);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
  } catch (error) {
    return expectedFailure(error, 'Could not restore that day.');
  }

  revalidatePath(sessionPath(sessionId));

  return success('Day restored.');
}

'use server';

import { revalidatePath } from 'next/cache';
import { isUuid, type Actor } from '@buxa/domain';
import { sessionPath } from '@buxa/shared/config/routes';
import { failure, field, seriesForm, seriesNameForm, success, type ActionState } from '@buxa/shared';
import type { NewSeriesInput, Series } from '@buxa/contracts';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';

/** A saved series as the edit form would post it, so a name-only edit keeps every other field as it is saved. */
function seriesAsInput(series: Series): NewSeriesInput {
  return {
    name: series.name,
    ageRange: series.ageRange,
    capacity: series.capacity,
    location: series.location,
    instructorIds: series.instructorIds,
    price: series.price,
    weekdays: series.weekdays,
    startsAt: series.startsLocal,
    endsAt: series.endsLocal,
  };
}

/** The edit's input: the whole form, or for a teacher (who posts the name only) the name over the series as it is saved. */
async function editInput(form: FormData, seriesId: string, actor: Actor): Promise<ReturnType<typeof seriesForm>> {
  if (field(form, 'detailsOnly') !== 'yes') {
    return seriesForm(form);
  }
  const saved = await getRuntime().services.classes.getSeries(actor, seriesId);
  if (!saved.ok) {
    return { ok: false, state: failure(saved.failure.message) };
  }

  return seriesNameForm(form, seriesAsInput(saved.value));
}

/**
 * Saves a series from the edit form, which is the New class form prefilled: the shared fields, the weekdays and the Starts and Ends
 * date-times. The service changes the days that differ (adding and removing them) or refuses the edit. A teacher on the series posts
 * the name only (`detailsOnly`); the rest is kept as saved, and the service refuses any other change.
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
  const services = getRuntime().services.classes;
  try {
    const input = await editInput(form, seriesId, actor);
    if (!input.ok) {
      return input.state;
    }
    const outcome = await services.updateSeries(actor, seriesId, input.data);
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

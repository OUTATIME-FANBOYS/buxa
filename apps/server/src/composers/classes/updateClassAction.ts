'use server';

import { revalidatePath } from 'next/cache';
import { can, isUuid } from '@buxa/domain';
import { ClassInputSchema } from '@buxa/contracts';
import { sessionPath } from '@buxa/shared/config/routes';
import { classForm, failure, field, success, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';
import { campZone } from '../attendance/campActor';

/**
 * Edit a class's own fields: name, ages, camp size, time range, location and instructors. The service checks classes:manage and
 * the rules (the class inside its session's dates, the camp size not below the places taken) before anything is written. A teacher
 * (events:update_details) changes the name only; the service refuses any other field.
 */
export async function updateClassAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }

  const classId = field(form, 'classId');
  if (!isUuid(classId)) {
    return failure('That class no longer exists.');
  }

  let sessionId: string | null = null;
  try {
    const classes = getRuntime().services.classes;
    let input;
    if (can(actor, 'classes:manage')) {
      const parsed = classForm(form, await campZone(actor));
      if (!parsed.ok) {
        return parsed.state;
      }
      input = parsed.data;
    } else {
      // A teacher's form carries the name only. Every other field is kept as saved, so the change is the name alone; the service
      // still refuses any other field that differs.
      const saved = await classes.getClass(actor, classId);
      if (!saved.ok) {
        return failure(saved.failure.message);
      }
      const named = ClassInputSchema.safeParse({ ...saved.value, name: field(form, 'name').trim() });
      if (!named.success) {
        return failure(named.error.issues[0]?.message ?? 'Check the class name.');
      }
      input = named.data;
    }
    const outcome = await classes.updateClass(actor, classId, input);
    if (!outcome.ok) {
      return failure(outcome.failure.message);
    }
    sessionId = outcome.value.sessionId;
  } catch (error) {
    return expectedFailure(error, 'Could not save the class.');
  }

  if (sessionId) {
    revalidatePath(sessionPath(sessionId));
  }

  return success('Class saved.');
}

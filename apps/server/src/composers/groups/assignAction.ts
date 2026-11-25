'use server';

import { revalidatePath } from 'next/cache';
import type { AssignInput } from '@buxa/contracts';
import { isUuid, type Actor } from '@buxa/domain';
import { assignPath } from '@buxa/shared/config/routes';
import {
  assignInputsForm,
  failure,
  field,
  ratioKey,
  refusedKey,
  RATIO_REFUSAL_KEY,
  success,
  type ActionState,
  type FieldErrors,
} from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure, NO_CAMP } from '../people/failures';
import { loadSessionGroups } from './loadGroupsPage';

/** One person the service refused, with the reason in plain words. */
interface Refusal {
  personId: string;
  reason: string;
  message: string;
}

/**
 * Places the chosen people in one group and room, one at a time. Each placement is checked on its own by the service (capacity, age,
 * ratio, room use), and no transaction spans them: a person placed before another is refused stays placed. The state names each
 * refused person and the reason. A ratio refusal also carries the ratio key, so the form can offer the admin's override for those people.
 */
export async function assignAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) {
    return failure(NO_CAMP);
  }
  const sessionId = field(form, 'sessionId');
  if (!isUuid(sessionId)) {
    return failure('That session no longer exists.');
  }
  const parsed = assignInputsForm(form);
  if (!parsed.ok) {
    return parsed.state;
  }

  const placed: string[] = [];
  const refused: Refusal[] = [];
  try {
    for (const input of parsed.data) {
      const outcome = await getRuntime().services.groups.assign(actor, input);
      if (outcome.ok) {
        placed.push(outcome.value.personName);
      } else {
        refused.push({ personId: input.personId, reason: outcome.failure.reason, message: outcome.failure.message });
      }
    }
  } catch (error) {
    return expectedFailure(error, 'Could not place this person.');
  } finally {
    if (placed.length > 0) {
      revalidatePath(assignPath(sessionId));
    }
  }

  if (refused.length === 0) {
    return success(placed.length === 1 ? `${placed[0]} is placed.` : `${placed.length} people are placed.`);
  }

  return failure(await refusalMessage(actor, sessionId, parsed.data, placed.length, refused), refusalErrors(refused));
}

/** One refusal reads as its reason. Several name each person, after how many were placed. */
async function refusalMessage(
  actor: Actor,
  sessionId: string,
  inputs: readonly AssignInput[],
  placedCount: number,
  refused: readonly Refusal[],
): Promise<string> {
  if (inputs.length === 1 && refused[0]) {
    return refused[0].message;
  }
  const names = await namesById(actor, sessionId);
  const lines = refused.map(r => `${names.get(r.personId) ?? 'A person'}: ${r.message}`);

  return [placedCount > 0 ? `${placedCount} placed.` : null, ...lines].filter(Boolean).join(' ');
}

/** Each refused person under their own key, and the first ratio refusal under the key the override pop-up reads. */
function refusalErrors(refused: readonly Refusal[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const r of refused) {
    errors[refusedKey(r.personId)] = r.message;
    if (r.reason === 'ratio') {
      errors[ratioKey(r.personId)] = r.message;
      errors[RATIO_REFUSAL_KEY] ??= r.message;
    }
  }

  return errors;
}

/** The session's people by id, for the names in a refusal. Empty when the session cannot be read; the refusal still says why. */
async function namesById(actor: Actor, sessionId: string): Promise<Map<string, string>> {
  const loaded = await loadSessionGroups(actor, sessionId);
  if (!loaded.ok) {
    return new Map();
  }

  return new Map([...loaded.value.campers, ...loaded.value.staff].map(p => [p.id, p.name] as const));
}

import type { ZodType } from 'zod';
import type { Actor } from '@buxa/domain';
import { isHttpError } from '@/server/http/errors';
import type { ActionOutcome } from '../actions/outcome';
import { campActor } from './campActor';

/**
 * The shape every attendance action shares: validate the posted input with the contract's schema, find the actor, call one service
 * method, and map the two problems a person can cause (403, 400) to outcomes. Other errors are rethrown.
 */
export async function runAttendanceAction<I, R>(
  schema: ZodType<I>, input: unknown, call: (actor: Actor, data: I) => Promise<R>,
): Promise<ActionOutcome<R>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { kind: 'invalid', message: parsed.error.issues[0]?.message ?? 'Check the details.' };
  const actor = await campActor();
  if (!actor) return { kind: 'forbidden', message: 'Choose a camp first.' };
  try {
    return { kind: 'ok', value: await call(actor, parsed.data) };
  } catch (error) {
    if (isHttpError(error) && error.statusCode === 403) return { kind: 'forbidden', message: error.message };
    if (isHttpError(error) && error.statusCode === 400) return { kind: 'invalid', message: error.message };
    throw error;
  }
}

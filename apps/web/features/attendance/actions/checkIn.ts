'use server';

import { CheckInInputSchema } from '@buxa/contracts';
import { getRuntime } from '@/server/runtime';
import type { CheckInResult } from '@/server/services';
import { runAttendanceAction } from '../lib/runAction';
import type { ActionOutcome } from './outcome';

/** Check a person in. Every refusal comes back as a result the screen can explain; an override needs a written reason. */
export async function checkInAction(input: unknown): Promise<ActionOutcome<CheckInResult>> {
  return runAttendanceAction(CheckInInputSchema, input, (actor, data) => getRuntime().services.attendance.checkIn(actor, data));
}

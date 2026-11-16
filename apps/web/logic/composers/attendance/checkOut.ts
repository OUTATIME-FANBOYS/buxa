'use server';

import { CheckOutInputSchema } from '@buxa/contracts';
import { getRuntime } from '../../../server/runtime';
import type { CheckOutResult } from '../../../server/services/attendance/AttendanceService';
import { runAttendanceAction } from './runAction';
import type { ActionOutcome } from '../../common';

/** Check a person out. A child needs an authorised guardian (or an admin's written reason); refusals come back as results. */
export async function checkOutAction(input: unknown): Promise<ActionOutcome<CheckOutResult>> {
  return runAttendanceAction(CheckOutInputSchema, input, (actor, data) => getRuntime().services.attendance.checkOut(actor, data));
}

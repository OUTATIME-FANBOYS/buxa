'use server';

import { CheckInInputSchema } from '@buxa/contracts';
import { getRuntime } from '../../runtime';
import type { CheckInResult } from '../../services/attendance/AttendanceService';
import { runAttendanceAction } from './runAction';
import type { ActionOutcome } from '@buxa/shared';
import { settle } from '@buxa/domain';

/** Check a person in. Every refusal comes back as a result the screen can explain; an override needs a written reason. */
export function checkInAction(input: unknown): Promise<ActionOutcome<CheckInResult>> {
  return settle(() => {
    return runAttendanceAction(CheckInInputSchema, input, (actor, data) => getRuntime().services.attendance.checkIn(actor, data));
  });
}

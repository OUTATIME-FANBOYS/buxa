'use server';

import { getRuntime } from '@/server/runtime';
import { lookupFor, type Lookup } from '../lib/card';
import { ScanInputSchema } from '../lib/inputs';
import { runAttendanceAction } from '../lib/runAction';
import type { ActionOutcome } from './outcome';

/** Read a code from the scanner or camera. One neutral `unknown` for every code that does not identify a person. */
export async function scanCodeAction(input: unknown): Promise<ActionOutcome<Lookup>> {
  return runAttendanceAction(ScanInputSchema, input, async (actor, data) => {
    const { services } = getRuntime();
    const scan = await services.credentials.scan(actor, data.raw);
    return lookupFor(scan, scan.kind === 'person' ? await services.attendance.onSite(actor) : []);
  });
}

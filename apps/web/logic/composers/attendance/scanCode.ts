'use server';

import { getRuntime } from '../../../server/runtime';
import { RATE_RULES, enforceRateLimit } from '../../../server/rateLimit/limiter';
import { lookupFor, type Lookup } from '@buxa/shared';
import { ScanInputSchema } from '@buxa/shared';
import { runAttendanceAction } from './runAction';
import type { ActionOutcome } from '@buxa/shared';

/** Read a code from the scanner or camera. One neutral `unknown` for every code that does not identify a person. */
export async function scanCodeAction(input: unknown): Promise<ActionOutcome<Lookup>> {
  return runAttendanceAction(ScanInputSchema, input, async (actor, data) => {
    const runtime = getRuntime();
    await enforceRateLimit(runtime.rateLimiter, RATE_RULES.scanCode, actor.userId);
    const { services } = runtime;
    const scan = await services.credentials.scan(actor, data.raw);
    return lookupFor(scan, scan.kind === 'person' ? await services.attendance.onSite(actor) : []);
  });
}

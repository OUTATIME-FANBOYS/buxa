import 'server-only';
import type { StartupDecision } from './auth/emailConfirmation';
import { getRuntime } from './runtime';

/** Where people are sent while the start-up check refuses to serve. Outside the (app) group, so it needs no session. */
export const MAINTENANCE_PATH = '/maintenance';

/** The same decision the API answers 503 on: 'refuse' means the app must not serve anyone. */
export const isRefusing = (decision: StartupDecision): boolean => decision === 'refuse';

/** Whether this process is refusing to serve, from the start-up check the API also uses. */
export async function isServiceRefused(): Promise<boolean> {
  return isRefusing(await getRuntime().startupCheck);
}

/**
 * The rules of check-in with a family's email (docs/phases/04-seats-rosters.md, "Check-in with a family's email"). Pure: no I/O.
 * The database functions in migration 0068 enforce the same numbers; keep them in step.
 */

/** A code is good for ten minutes from when it is sent. */
export const GATE_CODE_MINUTES = 10;
/** A code allows five wrong tries; the fifth wrong try voids it. */
export const GATE_MAX_ATTEMPTS = 5;
/** A new code for a family waits this long after the last one was sent. */
export const GATE_CODE_COOLDOWN_SECONDS = 60;
/** A device token lasts until the camp's season end, or this many days when the camp records none. */
export const DEVICE_TOKEN_DAYS = 180;
/** A code must be verified this soon before its device token is issued (the verify and the issue are two requests). */
export const DEVICE_ISSUE_WINDOW_MINUTES = 5;

/** The email as the lookup and the sender use it: trimmed and lower case. */
export function normaliseGateEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** A plausible address. The check is for shape only; it never says whether the address is on file. */
export function looksLikeGateEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseGateEmail(input)) && input.length <= 254;
}

/** The state of the newest code a family may still use. */
export interface GateCodeState {
  expiresAt: Date;
  attempts: number;
}

/**
 * What a submitted code does:
 *  - `ok`      the code matched: it is used, and a device token may follow;
 *  - `wrong`   it did not match: one attempt is counted and the code stays live;
 *  - `void`    it did not match and used the last attempt: the code is void (a new one must be requested);
 *  - `refused` there is no live code (none, expired, or already void). Nothing about the family is revealed by the answer.
 */
export type GateCodeDecision =
  { kind: 'ok' } | { kind: 'wrong'; attempts: number } | { kind: 'void' } | { kind: 'refused' };

export function decideGateCode(code: GateCodeState | null, now: Date, matches: boolean): GateCodeDecision {
  if (code === null || code.expiresAt.getTime() <= now.getTime() || code.attempts >= GATE_MAX_ATTEMPTS) {
    return { kind: 'refused' };
  }
  if (matches) {
    return { kind: 'ok' };
  }
  const attempts = code.attempts + 1;

  return attempts >= GATE_MAX_ATTEMPTS ? { kind: 'void' } : { kind: 'wrong', attempts };
}

/** Whether a new code may be sent now, given when the last one was sent for the same family. */
export function codeCooldownPassed(lastSentAt: Date | null, now: Date): boolean {
  return lastSentAt === null || now.getTime() - lastSentAt.getTime() >= GATE_CODE_COOLDOWN_SECONDS * 1000;
}

export function codeExpiresAt(now: Date): Date {
  return new Date(now.getTime() + GATE_CODE_MINUTES * 60_000);
}

/**
 * When a device token expires: the camp's season end when it is still ahead, otherwise 180 days from now.
 */
export function deviceExpiresAt(seasonEnd: Date | null, now: Date): Date {
  if (seasonEnd !== null && seasonEnd.getTime() > now.getTime()) {
    return seasonEnd;
  }

  return new Date(now.getTime() + DEVICE_TOKEN_DAYS * 86_400_000);
}

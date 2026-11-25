import { createHmac, randomBytes, randomInt } from 'node:crypto';

/**
 * The secrets of check-in with a family's email. Each one is random (the link token and the device token from the OS CSPRNG, the
 * code from randomInt). Only a keyed hash is stored: HMAC-SHA256 with GATE_PEPPER from the server's environment. The pepper is what
 * keeps a six-digit code from being reversed from a leaked table, since the code alone has only a million values.
 */

/** A link or device token: 256 bits, as 43 base64url characters. Shown or sent once; only its hash is a lookup key. */
export const gateToken = (): string => randomBytes(32).toString('base64url');

/** A six-digit code, with leading zeros. */
export const gateCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** What a hash is for. The scope is part of the input, so the same value hashed for two purposes gives two different hashes. */
export type GateHashScope = 'link' | 'device' | 'code' | 'email';

export function hashGateSecret(pepper: string, scope: GateHashScope, value: string): Buffer {
  return createHmac('sha256', pepper).update(`${scope}\u0000${value}`, 'utf8').digest();
}

/** A code is bound to its household, so a code sent for one family does not check for another. */
export const codeHashFor = (pepper: string, householdId: string, code: string): Buffer =>
  hashGateSecret(pepper, 'code', `${householdId}\u0000${code}`);

/** The rate-limit identity for an email: keyed, so no address is kept in the clear even inside a rate-limit key. */
export const emailIdentity = (pepper: string, normalisedEmail: string): string =>
  `email:${hashGateSecret(pepper, 'email', normalisedEmail).toString('hex')}`;

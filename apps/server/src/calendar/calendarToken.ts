import { createHash, randomBytes } from 'node:crypto';

/** A feed token: 256 bits from the OS CSPRNG, as 43 base64url characters. Long enough that a URL cannot be guessed. */
export const CALENDAR_TOKEN_BYTES = 32;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export const generateCalendarToken = (): string => randomBytes(CALENDAR_TOKEN_BYTES).toString('base64url');

/** SHA-256 of the token (32 bytes). The database stores only this, so a leaked table cannot be used as a feed URL. */
export const hashCalendarToken = (token: string): Buffer => createHash('sha256').update(token, 'utf8').digest();

/** A string that cannot be a token is refused before any database read. */
export const looksLikeCalendarToken = (value: string): boolean => TOKEN_SHAPE.test(value);

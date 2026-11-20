import { createHash, randomBytes } from 'node:crypto';

/** An invite token: 256 bits from the OS CSPRNG, as 43 base64url characters. Shown once; the database keeps only its hash. */
export const INVITE_TOKEN_BYTES = 32;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export const generateInviteToken = (): string => randomBytes(INVITE_TOKEN_BYTES).toString('base64url');

/** SHA-256 of the token (32 bytes). Only this is stored, so a leaked table cannot be used as an invite link. */
export const hashInviteToken = (token: string): Buffer => createHash('sha256').update(token, 'utf8').digest();

/** A string that cannot be a token is refused before any database read. */
export const looksLikeInviteToken = (value: string): boolean => TOKEN_SHAPE.test(value);

import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { CREDENTIAL_TOKEN_BYTES } from '@buxa/domain';

/** A new badge token: 128 bits from the OS CSPRNG as 22 base64url characters. */
export const generateCredentialToken = (): string => randomBytes(CREDENTIAL_TOKEN_BYTES).toString('base64url');

/** SHA-256 of the token (32 bytes): the only form the server stores. */
export const hashCredentialToken = (token: string): Buffer => createHash('sha256').update(token, 'utf8').digest();

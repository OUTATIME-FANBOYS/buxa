/**
 * Badge tokens. Frozen interface; the implementation lands in chunk P5.
 * `generateCredentialToken` returns 128 bits from a CSPRNG as 22 base64url characters (see CREDENTIAL_TOKEN_BYTES in @buxa/domain).
 * `hashCredentialToken` returns its SHA-256 (32 bytes), the only form that is stored.
 */
import { unimplemented } from '@/server/unimplemented';

interface QrTokens { generateCredentialToken(): string; hashCredentialToken(token: string): Buffer }
const stub = unimplemented<QrTokens>('lib/qr');
export const generateCredentialToken = (): string => stub.generateCredentialToken();
export const hashCredentialToken = (token: string): Buffer => stub.hashCredentialToken(token);

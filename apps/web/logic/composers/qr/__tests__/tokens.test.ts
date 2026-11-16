import { describe, expect, it } from 'vitest';
import { CREDENTIAL_TOKEN_BYTES } from '@buxa/domain';
import { generateCredentialToken, hashCredentialToken } from '../tokens';

describe('badge tokens', () => {
  it('generates url-safe base64 of the credential size, different each time', () => {
    const token = generateCredentialToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url').length).toBe(CREDENTIAL_TOKEN_BYTES);
    expect(generateCredentialToken()).not.toBe(token);
  });
  it('stores a 32-byte SHA-256 that is deterministic and differs per token', () => {
    const hash = hashCredentialToken('abc');
    expect(hash).toHaveLength(32);
    expect(hashCredentialToken('abc').equals(hash)).toBe(true);
    expect(hashCredentialToken('abd').equals(hash)).toBe(false);
  });
});

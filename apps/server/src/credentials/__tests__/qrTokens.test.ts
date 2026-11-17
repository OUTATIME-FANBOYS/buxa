import { describe, expect, it } from 'vitest';
import { isCredentialToken } from '@buxa/domain';
import { generateCredentialToken, hashCredentialToken } from '../qrTokens';

describe('credential tokens', () => {
  it('is 22 base64url characters and passes the domain check', () => {
    for (let i = 0; i < 50; i++) {
      const t = generateCredentialToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(isCredentialToken(t)).toBe(true);
    }
  });
  it('does not repeat over 1000 tokens', () => {
    expect(new Set(Array.from({ length: 1000 }, generateCredentialToken)).size).toBe(1000);
  });
  it('hashes to 32 bytes, deterministically, without containing the token', () => {
    const t = generateCredentialToken();
    const h = hashCredentialToken(t);
    expect(h).toBeInstanceOf(Buffer);
    expect(h.length).toBe(32);
    expect(h.equals(hashCredentialToken(t))).toBe(true);
    expect(h.includes(Buffer.from(t))).toBe(false);
    expect(h.toString('base64url')).not.toContain(t);
  });
  it('gives different tokens different hashes', () => {
    expect(hashCredentialToken(generateCredentialToken()).equals(hashCredentialToken(generateCredentialToken()))).toBe(false);
  });
});

/** Rasterise the path (8 px per module) into the RGBA buffer a decoder expects. */

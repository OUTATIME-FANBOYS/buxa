import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { BadgeKeyError, BadgeOpenError, createBadgeCipher, parseBadgeKey, type SealedToken } from '../badgeCipher';

// A fixed test key: 32 bytes, base64 encoded. Never a real key.
const TEST_KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');
const TOKEN = 'abcdefghijklmnopqrstuv';

const cipherWith = (encoded: string) => createBadgeCipher(() => parseBadgeKey(encoded));

describe('badge cipher', () => {
  it('round-trips a token through seal and open', () => {
    const cipher = cipherWith(TEST_KEY);
    const sealed = cipher.seal(TOKEN);
    expect(cipher.open(sealed)).toBe(TOKEN);
  });

  it('stores ciphertext that is not the plain token, with a fresh 12-byte IV and a 16-byte tag each time', () => {
    const cipher = cipherWith(TEST_KEY);
    const first = cipher.seal(TOKEN);
    const second = cipher.seal(TOKEN);
    expect(first.ciphertext.equals(Buffer.from(TOKEN, 'utf8'))).toBe(false);
    expect(first.iv).toHaveLength(12);
    expect(first.authTag).toHaveLength(16);
    expect(first.iv.equals(second.iv)).toBe(false);
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
  });

  it('fails when a stored ciphertext byte is changed (tamper detection)', () => {
    const cipher = cipherWith(TEST_KEY);
    const sealed = cipher.seal(TOKEN);
    const changed = Buffer.from(sealed.ciphertext);
    changed[0] = changed[0] ^ 0x01;
    expect(() => cipher.open({ ...sealed, ciphertext: changed })).toThrow(BadgeOpenError);
  });

  it('fails when the auth tag or the IV is changed', () => {
    const cipher = cipherWith(TEST_KEY);
    const sealed = cipher.seal(TOKEN);
    const tag = Buffer.from(sealed.authTag);
    tag[15] = tag[15] ^ 0xff;
    expect(() => cipher.open({ ...sealed, authTag: tag })).toThrow(BadgeOpenError);
    const iv = Buffer.from(sealed.iv);
    iv[0] = iv[0] ^ 0x01;
    expect(() => cipher.open({ ...sealed, iv })).toThrow(BadgeOpenError);
  });

  it('fails with a wrong key', () => {
    const sealed: SealedToken = cipherWith(TEST_KEY).seal(TOKEN);
    expect(() => cipherWith(OTHER_KEY).open(sealed)).toThrow(BadgeOpenError);
  });

  it('refuses a missing key, and a key that is not 32 bytes, with a configuration error', () => {
    expect(() => parseBadgeKey(undefined)).toThrow(BadgeKeyError);
    expect(() => parseBadgeKey('')).toThrow(BadgeKeyError);
    expect(() => parseBadgeKey(randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
    expect(() => parseBadgeKey(randomBytes(33).toString('base64'))).toThrow(BadgeKeyError);
    expect(parseBadgeKey(TEST_KEY)).toHaveLength(32);
  });

  it('reads the key only when a badge is sealed or opened, and once for all later uses', () => {
    const loadKey = vi.fn(() => parseBadgeKey(TEST_KEY));
    const cipher = createBadgeCipher(loadKey);
    expect(loadKey).not.toHaveBeenCalled();
    const sealed = cipher.seal(TOKEN);
    cipher.open(sealed);
    cipher.seal(TOKEN);
    expect(loadKey).toHaveBeenCalledTimes(1);
  });

  it('throws the configuration error on use when the key is missing, and does not cache the failure', () => {
    const environment: { key: string | undefined } = { key: undefined };
    const cipher = createBadgeCipher(() => parseBadgeKey(environment.key));
    expect(() => cipher.seal(TOKEN)).toThrow(BadgeKeyError);
    environment.key = TEST_KEY;
    expect(cipher.open(cipher.seal(TOKEN))).toBe(TOKEN);
  });
});

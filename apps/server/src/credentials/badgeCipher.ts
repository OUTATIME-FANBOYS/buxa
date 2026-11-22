import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encrypts badge tokens at rest (AES-256-GCM). The key is the environment secret BADGE_ENCRYPTION_KEY: 32 random bytes, base64
 * encoded. It is read the first time a badge is sealed or opened, then kept for the life of the process. Nothing here runs at import
 * time, so the rest of the app starts and serves without the key. A missing or wrong-sized key is a BadgeKeyError on use only.
 */
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

/** What is stored for one badge: the ciphertext, its random IV and the GCM auth tag. */
export interface SealedToken {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export interface BadgeCipher {
  seal(token: string): SealedToken;
  /** Throws BadgeOpenError when the ciphertext, IV or tag was changed, or the key is not the one that sealed it. */
  open(sealed: SealedToken): string;
}

/** The key is missing or not 32 bytes. An operator fix, not something a person can do. */
export class BadgeKeyError extends Error {
  readonly kind = 'badge-key';
  constructor(message: string) {
    super(message);
    this.name = 'BadgeKeyError';
  }
}

/** A stored badge did not open: it was changed, or it was sealed with another key. */
export class BadgeOpenError extends Error {
  readonly kind = 'badge-open';
  constructor() {
    super('A stored badge could not be opened.');
    this.name = 'BadgeOpenError';
  }
}

/** True for a BadgeKeyError from any copy of this module (see isHttpError for why not `instanceof`). */
export const isBadgeKeyError = (error: unknown): error is BadgeKeyError =>
  error instanceof Error && 'kind' in error && error.kind === 'badge-key';

/** Decodes the base64 key from the environment and checks its size. Throws BadgeKeyError. */
export function parseBadgeKey(encoded: string | undefined): Buffer {
  if (!encoded) {
    throw new BadgeKeyError(
      'BADGE_ENCRYPTION_KEY is not set. Set it to 32 random bytes, base64 encoded, before issuing or showing badges.',
    );
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new BadgeKeyError('BADGE_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of 32 random bytes).');
  }

  return key;
}

/** A cipher whose key comes from `loadKey`, called once, the first time it is needed. A failed load is retried next time. */
export function createBadgeCipher(loadKey: () => Buffer): BadgeCipher {
  let key: Buffer | null = null;
  const keyOnce = (): Buffer => {
    key ??= loadKey();

    return key;
  };

  return {
    seal(token) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, keyOnce(), iv);
      const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);

      return { ciphertext, iv, authTag: cipher.getAuthTag() };
    },
    open(sealed) {
      try {
        const decipher = createDecipheriv(ALGORITHM, keyOnce(), sealed.iv, { authTagLength: AUTH_TAG_BYTES });
        decipher.setAuthTag(sealed.authTag);

        return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString('utf8');
      } catch (error) {
        if (isBadgeKeyError(error)) {
          throw error;
        }
        throw new BadgeOpenError();
      }
    },
  };
}

/** The cipher the server uses: the key comes from BADGE_ENCRYPTION_KEY, read on first use. */
export const badgeCipher: BadgeCipher = createBadgeCipher(() => parseBadgeKey(process.env.BADGE_ENCRYPTION_KEY));

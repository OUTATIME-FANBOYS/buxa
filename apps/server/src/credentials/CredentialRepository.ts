import type { Actor } from '@buxa/domain';
import type { SealedToken } from './badgeCipher';

export interface CredentialRecord {
  id: string;
  personId: string;
  issuedAt: string;
  issuedBy: string | null;
  revokedAt: string | null;
}

/** The active badge of a person, as far as showing it goes. `sealed` is null for a badge issued before encrypted copies existed. */
export interface RevealedBadge {
  credentialId: string;
  sealed: SealedToken | null;
}

/**
 * Storage for badges. The SHA-256 hash of the token (a 32-byte Buffer) is the lookup key. The token itself reaches storage only as
 * `sealed` (AES-256-GCM, see badgeCipher.ts), and only for the active badge: a revoked badge is wiped.
 */
export interface CredentialRepository {
  /**
   * Atomically revokes the person's active badge (if any) and stores the new one. Audits `badge.reissue` when it replaces one,
   * otherwise `credential.issue`. Throws PersonNotFoundError. `sealed` is optional only for tests of the hash path.
   */
  issue(
    actor: Actor,
    personId: string,
    tokenHash: Buffer,
    at: string,
    sealed?: SealedToken | null,
  ): Promise<CredentialRecord>;
  /** Revokes the active badge and wipes its sealed copy; returns it, or null if there was none (then nothing is audited). Audits `credential.revoke`. */
  revoke(actor: Actor, personId: string, at: string): Promise<CredentialRecord | null>;
  /**
   * The person's active badge with its sealed copy, for showing or reprinting it. Audits `action` in the same transaction. Null when
   * the person has no active badge (then nothing is audited).
   */
  reveal(actor: Actor, personId: string, action: 'badge.view' | 'badge.reprint'): Promise<RevealedBadge | null>;
  activeFor(userId: string, orgId: string, personId: string): Promise<CredentialRecord | null>;
  /** The person an ACTIVE badge belongs to. Revoked and unknown hashes both give null. */
  resolve(userId: string, orgId: string, tokenHash: Buffer): Promise<string | null>;
  /** Which of these people hold an active badge. */
  withActive(userId: string, orgId: string, personIds: readonly string[]): Promise<Set<string>>;
}

/** Raised when a concurrent badge issue for the same person wins the race (the active-badge unique index rejects this one). */
export class BadgeConflictError extends Error {
  readonly kind = 'badge-conflict';
  constructor() {
    super('A badge was issued at the same time. Refresh and try again.');
    this.name = 'BadgeConflictError';
  }
}

/** True for a BadgeConflictError from any copy of this module (see isHttpError for why not `instanceof`). */
export const isBadgeConflict = (error: unknown): error is BadgeConflictError =>
  error instanceof Error && 'kind' in error && error.kind === 'badge-conflict';

import type { Actor } from '@buxa/domain';

export interface CredentialRecord { id: string; personId: string; issuedAt: string; issuedBy: string | null; revokedAt: string | null }

/**
 * Storage for badges. Only the SHA-256 hash of the token ever reaches storage (a 32-byte Buffer); the adapter never sees the token.
 */
export interface CredentialRepository {
  /** Atomically revokes the person's active badge (if any) and stores the new one. Audits `credential.issue`. Throws PersonNotFoundError. */
  issue(actor: Actor, personId: string, tokenHash: Buffer, at: string): Promise<CredentialRecord>;
  /** Revokes the active badge; returns it, or null if there was none (then nothing is audited). Audits `credential.revoke`. */
  revoke(actor: Actor, personId: string, at: string): Promise<CredentialRecord | null>;
  activeFor(orgId: string, personId: string): Promise<CredentialRecord | null>;
  /** The person an ACTIVE badge belongs to. Revoked and unknown hashes both give null. */
  resolve(orgId: string, tokenHash: Buffer): Promise<string | null>;
  /** Which of these people hold an active badge. */
  withActive(orgId: string, personIds: readonly string[]): Promise<Set<string>>;
}

/** Raised when a concurrent badge issue for the same person wins the race (the active-badge unique index rejects this one). */
export class BadgeConflictError extends Error {
  readonly kind = 'badge-conflict';
  constructor() {
    super('A badge was issued at the same time. Refresh and try again.'); this.name = 'BadgeConflictError';
  }
}

/** True for a BadgeConflictError from any copy of this module (see isHttpError for why not `instanceof`). */
export const isBadgeConflict = (error: unknown): error is BadgeConflictError => error instanceof Error && (error as { kind?: unknown }).kind === 'badge-conflict';

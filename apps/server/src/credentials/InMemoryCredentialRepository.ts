import type { Actor } from '@buxa/domain';
import { PersonNotFoundError } from '../people/PeopleRepository';
import { instant, newId, type InMemoryDatabase, type StoredCredential } from '../people/InMemoryDatabase';
import type { CredentialRecord, CredentialRepository, RevealedBadge } from './CredentialRepository';
import type { SealedToken } from './badgeCipher';
import { settle } from '@buxa/domain';

const copySealed = (sealed: SealedToken | null): SealedToken | null =>
  sealed && {
    ciphertext: Buffer.from(sealed.ciphertext),
    iv: Buffer.from(sealed.iv),
    authTag: Buffer.from(sealed.authTag),
  };

const toRecord = (c: StoredCredential): CredentialRecord => ({
  id: c.id,
  personId: c.personId,
  issuedAt: c.issuedAt,
  issuedBy: c.issuedBy,
  revokedAt: c.revokedAt,
});

/** In-memory adapter for badges, with the same errors and audit entries as Postgres. The hash is copied and never exposed. */
export class InMemoryCredentialRepository implements CredentialRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  issue(
    actor: Actor,
    personId: string,
    tokenHash: Buffer,
    at: string,
    sealed: SealedToken | null = null,
  ): Promise<CredentialRecord> {
    return settle(() => {
      if (!this.db.inOrg(this.db.people, actor.orgId, personId)) {
        throw new PersonNotFoundError();
      }
      const replaced = this.activeOf(actor.orgId, personId);
      if (replaced) {
        replaced.revokedAt = instant(at);
        replaced.sealed = null;
      }
      const credential: StoredCredential = {
        id: newId(),
        orgId: actor.orgId,
        personId,
        tokenHash: Buffer.from(tokenHash),
        sealed: copySealed(sealed),
        issuedAt: instant(at),
        issuedBy: actor.userId,
        revokedAt: null,
      };
      this.db.credentials.set(credential.id, credential);
      this.db.record(actor, replaced ? 'badge.reissue' : 'credential.issue', 'credential', credential.id, {
        personId,
        replaces: replaced?.id ?? null,
      });

      return toRecord(credential);
    });
  }

  revoke(actor: Actor, personId: string, at: string): Promise<CredentialRecord | null> {
    return settle(() => {
      const credential = this.activeOf(actor.orgId, personId);
      if (!credential) {
        return null;
      }
      credential.revokedAt = instant(at);
      credential.sealed = null;
      this.db.record(actor, 'credential.revoke', 'credential', credential.id, { personId });

      return toRecord(credential);
    });
  }

  reveal(actor: Actor, personId: string, action: 'badge.view' | 'badge.reprint'): Promise<RevealedBadge | null> {
    return settle(() => {
      const credential = this.activeOf(actor.orgId, personId);
      if (!credential) {
        return null;
      }
      this.db.record(actor, action, 'credential', credential.id, { personId });

      return { credentialId: credential.id, sealed: copySealed(credential.sealed) };
    });
  }

  activeFor(userId: string, orgId: string, personId: string): Promise<CredentialRecord | null> {
    return settle(() => {
      const credential = this.activeOf(orgId, personId);

      return credential ? toRecord(credential) : null;
    });
  }

  resolve(userId: string, orgId: string, tokenHash: Buffer): Promise<string | null> {
    return settle(() => {
      const match = [...this.db.credentials.values()].find(
        c => c.orgId === orgId && c.revokedAt === null && c.tokenHash.equals(tokenHash),
      );

      return match?.personId ?? null;
    });
  }

  withActive(userId: string, orgId: string, personIds: readonly string[]): Promise<Set<string>> {
    return settle(() => {
      const active = new Set<string>();
      for (const personId of personIds) {
        if (this.activeOf(orgId, personId)) {
          active.add(personId);
        }
      }

      return active;
    });
  }

  private activeOf(orgId: string, personId: string): StoredCredential | undefined {
    return [...this.db.credentials.values()].find(
      c => c.orgId === orgId && c.personId === personId && c.revokedAt === null,
    );
  }
}

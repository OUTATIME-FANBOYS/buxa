import type { Actor } from '@buxa/domain';
import { PersonNotFoundError } from '../people/PeopleRepository';
import { instant, newId, type InMemoryDatabase, type StoredCredential } from '../people/InMemoryDatabase';
import type { CredentialRecord, CredentialRepository } from './CredentialRepository';
import { settle } from '@buxa/domain';

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

  issue(actor: Actor, personId: string, tokenHash: Buffer, at: string): Promise<CredentialRecord> {
    return settle(() => {
      if (!this.db.inOrg(this.db.people, actor.orgId, personId)) {
        throw new PersonNotFoundError();
      }
      const replaced = this.activeOf(actor.orgId, personId);
      if (replaced) {
        replaced.revokedAt = instant(at);
      }
      const credential: StoredCredential = {
        id: newId(),
        orgId: actor.orgId,
        personId,
        tokenHash: Buffer.from(tokenHash),
        issuedAt: instant(at),
        issuedBy: actor.userId,
        revokedAt: null,
      };
      this.db.credentials.set(credential.id, credential);
      this.db.record(actor, 'credential.issue', 'credential', credential.id, { personId, replaces: replaced?.id ?? null });

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
      this.db.record(actor, 'credential.revoke', 'credential', credential.id, { personId });

      return toRecord(credential);
    });
  }

  activeFor(orgId: string, personId: string): Promise<CredentialRecord | null> {
    return settle(() => {
      const credential = this.activeOf(orgId, personId);

      return credential ? toRecord(credential) : null;
    });
  }

  resolve(orgId: string, tokenHash: Buffer): Promise<string | null> {
    return settle(() => {
      const match = [...this.db.credentials.values()].find(c => c.orgId === orgId && c.revokedAt === null && c.tokenHash.equals(tokenHash));

      return match?.personId ?? null;
    });
  }

  withActive(orgId: string, personIds: readonly string[]): Promise<Set<string>> {
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
    return [...this.db.credentials.values()].find(c => c.orgId === orgId && c.personId === personId && c.revokedAt === null);
  }
}

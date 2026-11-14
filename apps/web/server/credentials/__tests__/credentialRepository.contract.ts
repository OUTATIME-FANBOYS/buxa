import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isPersonNotFound } from '../../people/PeopleRepository';
import { expectRejection, ISO_INSTANT, samplePerson, tokenHash, type RepositoryFactory, type RepositoryFixture } from '../../people/__tests__/fixture';

/** One contract for every CredentialRepository adapter. The adapter only ever sees hashes. */
export function credentialRepositoryContract(factory: RepositoryFactory): void {
  describe('CredentialRepository contract', () => {
    let fx: RepositoryFixture;
    beforeEach(async () => { fx = await factory(); });
    afterEach(async () => { await fx.close(); });

    const newPerson = async (): Promise<string> => (await fx.repos.people.create(fx.actor, samplePerson())).id;

    it('issues a badge: the hash resolves to the person, and the record holds no hash', async () => {
      const personId = await newPerson();
      const badge = await fx.repos.credentials.issue(fx.actor, personId, tokenHash('one'), '2027-06-01T09:00:00.000Z');
      expect(badge).toEqual({
        id: badge.id, personId, issuedAt: '2027-06-01T09:00:00.000Z', issuedBy: fx.actor.userId, revokedAt: null,
      });
      expect(badge.issuedAt).toMatch(ISO_INSTANT);
      expect(Object.keys(badge)).not.toContain('tokenHash');
      expect(await fx.repos.credentials.resolve(fx.actor.orgId, tokenHash('one'))).toBe(personId);
      expect(await fx.repos.credentials.activeFor(fx.actor.orgId, personId)).toEqual(badge);
    });

    it('reissuing revokes the old badge: its hash stops resolving', async () => {
      const personId = await newPerson();
      const first = await fx.repos.credentials.issue(fx.actor, personId, tokenHash('old'), '2027-06-01T09:00:00.000Z');
      const second = await fx.repos.credentials.issue(fx.actor, personId, tokenHash('new'), '2027-06-02T09:00:00.000Z');
      expect(await fx.repos.credentials.resolve(fx.actor.orgId, tokenHash('old'))).toBeNull();
      expect(await fx.repos.credentials.resolve(fx.actor.orgId, tokenHash('new'))).toBe(personId);
      expect((await fx.repos.credentials.activeFor(fx.actor.orgId, personId))?.id).toBe(second.id);
      expect(first.id).not.toBe(second.id);
    });

    it('revoke returns the revoked badge, then null when there is none active', async () => {
      const personId = await newPerson();
      const badge = await fx.repos.credentials.issue(fx.actor, personId, tokenHash('a'), '2027-06-01T09:00:00.000Z');
      const revoked = await fx.repos.credentials.revoke(fx.actor, personId, '2027-06-03T09:00:00.000Z');
      expect(revoked).toMatchObject({ id: badge.id, revokedAt: '2027-06-03T09:00:00.000Z' });
      expect(await fx.repos.credentials.revoke(fx.actor, personId, '2027-06-04T09:00:00.000Z')).toBeNull();
      expect(await fx.repos.credentials.activeFor(fx.actor.orgId, personId)).toBeNull();
    });

    it('a revoked and an unknown hash give the same answer: null', async () => {
      const personId = await newPerson();
      await fx.repos.credentials.issue(fx.actor, personId, tokenHash('gone'), '2027-06-01T09:00:00.000Z');
      await fx.repos.credentials.revoke(fx.actor, personId, '2027-06-03T09:00:00.000Z');
      expect(await fx.repos.credentials.resolve(fx.actor.orgId, tokenHash('gone'))).toBeNull();
      expect(await fx.repos.credentials.resolve(fx.actor.orgId, tokenHash('never issued'))).toBeNull();
    });

    it('withActive returns only the people who hold an active badge', async () => {
      const withBadge = await newPerson();
      const revokedOnly = await newPerson();
      const none = await newPerson();
      await fx.repos.credentials.issue(fx.actor, withBadge, tokenHash('b1'), '2027-06-01T09:00:00.000Z');
      await fx.repos.credentials.issue(fx.actor, revokedOnly, tokenHash('b2'), '2027-06-01T09:00:00.000Z');
      await fx.repos.credentials.revoke(fx.actor, revokedOnly, '2027-06-02T09:00:00.000Z');
      expect([...await fx.repos.credentials.withActive(fx.actor.orgId, [withBadge, revokedOnly, none])]).toEqual([withBadge]);
    });

    it('issue throws PersonNotFoundError for an unknown person or another organisation\'s person', async () => {
      await expectRejection(fx.repos.credentials.issue(fx.actor, randomUUID(), tokenHash('x'), '2027-06-01T09:00:00.000Z'), isPersonNotFound);
      const theirs = (await fx.repos.people.create(fx.otherActor, samplePerson())).id;
      await expectRejection(fx.repos.credentials.issue(fx.actor, theirs, tokenHash('y'), '2027-06-01T09:00:00.000Z'), isPersonNotFound);
    });

    it('another organisation cannot resolve, read or revoke a badge', async () => {
      const personId = await newPerson();
      await fx.repos.credentials.issue(fx.actor, personId, tokenHash('mine'), '2027-06-01T09:00:00.000Z');
      expect(await fx.repos.credentials.resolve(fx.otherActor.orgId, tokenHash('mine'))).toBeNull();
      expect(await fx.repos.credentials.activeFor(fx.otherActor.orgId, personId)).toBeNull();
      expect(await fx.repos.credentials.revoke(fx.otherActor, personId, '2027-06-02T09:00:00.000Z')).toBeNull();
      expect(await fx.repos.credentials.resolve(fx.actor.orgId, tokenHash('mine'))).toBe(personId);
    });

    it('audits credential.issue (with what it replaced) and credential.revoke', async () => {
      const personId = await newPerson();
      await fx.repos.credentials.issue(fx.actor, personId, tokenHash('1'), '2027-06-01T09:00:00.000Z');
      await fx.repos.credentials.issue(fx.actor, personId, tokenHash('2'), '2027-06-02T09:00:00.000Z');
      await fx.repos.credentials.revoke(fx.actor, personId, '2027-06-03T09:00:00.000Z');
      expect((await fx.auditActions()).filter(a => a.startsWith('credential.'))).toEqual(['credential.issue', 'credential.issue', 'credential.revoke']);
    });
  });
}

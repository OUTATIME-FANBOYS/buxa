import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createCamp, thrown } from './support';

async function camperWithPerson(name = 'Ben') {
  const camp = await createCamp();
  const admin = camp.actor('admin');
  const person = await camp.people.create(admin, { givenName: name, familyName: 'Stone', roles: ['participant'] });
  return { camp, admin, person };
}

describe('CredentialService', () => {
  it('refuses issue and revoke without credentials:manage (403)', async () => {
    const { camp, person } = await camperWithPerson();
    expect((await thrown(() => camp.credentials.issue(camp.actor('staff'), person.id))).statusCode).toBe(403);
    expect((await thrown(() => camp.credentials.revoke(camp.actor('staff'), person.id))).statusCode).toBe(403);
    expect((await thrown(() => camp.credentials.issue(camp.actor('viewer'), person.id))).statusCode).toBe(403);
  });

  it('returns the token once, in the payload, and stores only its SHA-256 hash', async () => {
    const { camp, admin, person } = await camperWithPerson();
    const badge = await camp.credentials.issue(admin, person.id);

    expect(badge.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(badge.payload).toBe(`bx1.${badge.token}`);

    const hash = createHash('sha256').update(badge.token, 'utf8').digest();
    expect(await camp.repos.credentials.resolve(camp.orgId, hash)).toBe(person.id);
    // The raw token is not what is stored, so it must not resolve as a hash either.
    expect(await camp.repos.credentials.resolve(camp.orgId, Buffer.from(badge.token, 'utf8'))).toBeNull();

    // The token never appears in the audit trail.
    expect(JSON.stringify(camp.audit())).not.toContain(badge.token);
    expect(camp.audit().map(a => a.action)).toContain('credential.issue');
  });

  it('reissuing revokes the old badge', async () => {
    const { camp, admin, person } = await camperWithPerson();
    const first = await camp.credentials.issue(admin, person.id);
    const second = await camp.credentials.issue(admin, person.id);

    expect(await camp.credentials.scan(admin, first.payload)).toEqual({ kind: 'unknown' });
    expect((await camp.credentials.scan(admin, second.payload))).toMatchObject({ kind: 'person', person: { id: person.id } });
  });

  it('refuses to issue for an archived person (409) and for an unknown one (404)', async () => {
    const { camp, admin, person } = await camperWithPerson();
    await camp.people.archive(admin, person.id);
    expect((await thrown(() => camp.credentials.issue(admin, person.id))).statusCode).toBe(409);
    expect((await thrown(() => camp.credentials.issue(admin, '00000000-0000-4000-8000-000000000000'))).statusCode).toBe(404);
  });

  it('answers unknown for a malformed, unknown, revoked, archived or foreign code, all the same way', async () => {
    const { camp, admin, person } = await camperWithPerson();
    const staff = camp.actor('staff');
    const live = await camp.credentials.issue(admin, person.id);
    const unknownToken = `bx1.${'A'.repeat(22)}`;

    const answers = [
      await camp.credentials.scan(staff, 'not a badge at all'),
      await camp.credentials.scan(staff, ''),
      await camp.credentials.scan(staff, `bx1.short`),
      await camp.credentials.scan(staff, unknownToken),
    ];
    for (const answer of answers) expect(answer).toEqual({ kind: 'unknown' });

    await camp.credentials.revoke(admin, person.id);
    expect(await camp.credentials.scan(staff, live.payload)).toEqual({ kind: 'unknown' });

    const again = await camp.credentials.issue(admin, person.id);
    await camp.people.archive(admin, person.id);
    expect(await camp.credentials.scan(staff, again.payload)).toEqual({ kind: 'unknown' });
  });

  it('answers unknown for a code issued in another camp', async () => {
    const { camp, admin, person } = await camperWithPerson();
    const badge = await camp.credentials.issue(admin, person.id);
    const other = await createCamp();
    expect(await other.credentials.scan(other.actor('staff'), badge.payload)).toEqual({ kind: 'unknown' });
  });

  it('scans a live badge to a summary with status and on-site flag, for a viewer too', async () => {
    const { camp, admin, person } = await camperWithPerson();
    await camp.memberships.add(admin, { personId: person.id, plan: 'Summer', startsOn: '2027-07-01', endsOn: '2027-08-31' });
    const badge = await camp.credentials.issue(admin, person.id);
    const result = await camp.credentials.scan(camp.actor('viewer'), `  ${badge.payload}\n`);
    expect(result).toEqual({
      kind: 'person',
      person: { id: person.id, givenName: 'Ben', familyName: 'Stone', preferredName: null, roles: ['participant'], status: 'valid', onSite: false, archived: false },
    });
  });

  it('revoke is idempotent and needs credentials:manage', async () => {
    const { camp, admin, person } = await camperWithPerson();
    const badge = await camp.credentials.issue(admin, person.id);
    await camp.credentials.revoke(admin, person.id);
    await camp.credentials.revoke(admin, person.id);
    expect(await camp.credentials.scan(admin, badge.payload)).toEqual({ kind: 'unknown' });
  });
});

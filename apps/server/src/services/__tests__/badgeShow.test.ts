import { describe, expect, it } from 'vitest';
import type { Actor, Role } from '@buxa/domain';
import { createBadgeCipher, parseBadgeKey } from '../../credentials/badgeCipher';
import { createCredentialService } from '../credentials/createCredentialService';
import { createCamp, thrown, TEST_BADGE_KEY, type Camp } from './support';

/** A signed-in user with a camp membership, so the service sees an actor and a session email. */
async function signedIn(camp: Camp, email: string, role: Role): Promise<Actor> {
  const user = await camp.store.upsertFromIdentity({ authId: `auth-${email}`, email, name: email });
  camp.store.members.push({ orgId: camp.orgId, userId: user.id, role });

  return { userId: user.id, orgId: camp.orgId, role };
}

/** A guardian (with a household), a child in that household, and an unrelated participant, as an admin creates them. */
async function household(camp: Camp) {
  const admin = camp.actor('admin');
  const guardian = await camp.people.create(admin, {
    givenName: 'Gina',
    familyName: 'Lee',
    email: 'guardian@example.org',
    roles: ['guardian'],
    newHouseholdName: 'Lee family',
    relationship: 'Parent',
  });
  const [lee] = await camp.repos.people.householdsOf(admin.userId, camp.orgId, guardian.id);
  const child = await camp.people.create(admin, {
    givenName: 'Cal',
    familyName: 'Lee',
    email: 'cal@example.org',
    roles: ['participant'],
    householdId: lee.id,
    relationship: 'Child',
  });
  const unrelated = await camp.people.create(admin, {
    givenName: 'Una',
    familyName: 'Other',
    email: 'una@example.org',
    roles: ['participant'],
  });

  return { guardian, child, unrelated };
}

describe('badge show, reprint and reissue', () => {
  it('shows the same code that was issued, to an admin, for any person', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const { child } = await household(camp);
    const issued = await camp.credentials.issue(admin, child.id);

    const shown = await camp.credentials.show(admin, child.id, 'admin@example.org');
    expect(shown).toEqual({ kind: 'shown', payload: issued.payload });
  });

  it('refuses a staff member and a viewer (403), even for a person with a badge', async () => {
    const camp = await createCamp();
    const { child } = await household(camp);
    await camp.credentials.issue(camp.actor('admin'), child.id);

    expect(
      (await thrown(() => camp.credentials.show(camp.actor('staff'), child.id, 'staff@example.org'))).statusCode,
    ).toBe(403);
    expect(
      (await thrown(() => camp.credentials.show(camp.actor('viewer'), child.id, 'viewer@example.org'))).statusCode,
    ).toBe(403);
  });

  it('lets a signed-in person show their own badge', async () => {
    const camp = await createCamp();
    const { child } = await household(camp);
    const issued = await camp.credentials.issue(camp.actor('admin'), child.id);
    const cal = await signedIn(camp, 'cal@example.org', 'viewer');

    expect(await camp.credentials.show(cal, child.id, 'cal@example.org')).toEqual({
      kind: 'shown',
      payload: issued.payload,
    });
  });

  it('lets a guardian show each child in the same household, and refuses an unrelated person (403)', async () => {
    const camp = await createCamp();
    const { guardian, child, unrelated } = await household(camp);
    const issued = await camp.credentials.issue(camp.actor('admin'), child.id);
    const gina = await signedIn(camp, 'guardian@example.org', 'viewer');
    const una = await signedIn(camp, 'una@example.org', 'viewer');

    expect(await camp.credentials.show(gina, child.id, 'guardian@example.org')).toEqual({
      kind: 'shown',
      payload: issued.payload,
    });
    // A guardian's own badge is theirs to show too.
    await camp.credentials.issue(camp.actor('admin'), guardian.id);
    expect((await camp.credentials.show(gina, guardian.id, 'guardian@example.org')).kind).toBe('shown');

    // Someone outside the household is refused, for the child and for an unrelated person's badge.
    await camp.credentials.issue(camp.actor('admin'), unrelated.id);
    expect((await thrown(() => camp.credentials.show(una, child.id, 'una@example.org'))).statusCode).toBe(403);
    expect((await thrown(() => camp.credentials.show(una, guardian.id, 'una@example.org'))).statusCode).toBe(403);
    expect((await thrown(() => camp.credentials.show(gina, unrelated.id, 'guardian@example.org'))).statusCode).toBe(
      403,
    );
    // Showing your own badge is allowed even with no household: the unrelated participant may show theirs.
    expect((await camp.credentials.show(una, unrelated.id, 'una@example.org')).kind).toBe('shown');
  });

  it('a child is not a guardian: the child cannot show a sibling or the guardian', async () => {
    const camp = await createCamp();
    const { guardian, child } = await household(camp);
    await camp.credentials.issue(camp.actor('admin'), guardian.id);
    await camp.credentials.issue(camp.actor('admin'), child.id);
    const cal = await signedIn(camp, 'cal@example.org', 'viewer');

    expect((await thrown(() => camp.credentials.show(cal, guardian.id, 'cal@example.org'))).statusCode).toBe(403);
    expect((await camp.credentials.show(cal, child.id, 'cal@example.org')).kind).toBe('shown');
  });

  it('audits every show as badge.view, with the actor, the person and the credential, and never the code', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const { child } = await household(camp);
    const issued = await camp.credentials.issue(admin, child.id);
    await camp.credentials.show(admin, child.id, 'admin@example.org');

    const view = camp.audit().find(entry => entry.action === 'badge.view');
    expect(view).toMatchObject({
      actorId: admin.userId,
      entity: 'credential',
      data: { personId: child.id },
    });
    expect(JSON.stringify(camp.audit())).not.toContain(issued.token);
  });

  it('reprints the same code as badge.reprint, for admins and owners only', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const { guardian, child } = await household(camp);
    const issued = await camp.credentials.issue(admin, child.id);

    expect(await camp.credentials.reprint(camp.actor('owner'), child.id)).toEqual({
      kind: 'shown',
      payload: issued.payload,
    });
    expect(camp.audit().map(entry => entry.action)).toContain('badge.reprint');

    const gina = await signedIn(camp, 'guardian@example.org', 'viewer');
    expect((await thrown(() => camp.credentials.reprint(gina, child.id))).statusCode).toBe(403);
    expect((await thrown(() => camp.credentials.reprint(camp.actor('staff'), child.id))).statusCode).toBe(403);
    expect(guardian.id).not.toBe(child.id);
  });

  it('reissue replaces the code, shows the new one, and audits badge.reissue (a first badge is credential.issue)', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const { child } = await household(camp);
    const first = await camp.credentials.issue(admin, child.id);
    const second = await camp.credentials.issue(admin, child.id);

    expect(await camp.credentials.show(admin, child.id, 'admin@example.org')).toEqual({
      kind: 'shown',
      payload: second.payload,
    });
    expect(second.payload).not.toBe(first.payload);
    const actions = camp.audit().map(entry => entry.action);
    expect(actions.filter(a => a === 'credential.issue')).toHaveLength(1);
    expect(actions.filter(a => a === 'badge.reissue')).toHaveLength(1);
  });

  it('says reissue, not an error, for a badge issued before encrypted copies existed', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const { child } = await household(camp);
    // A badge with no sealed copy, as the repository stored them before this change.
    await camp.repos.credentials.issue(admin, child.id, Buffer.alloc(32, 1), '2027-07-10T12:00:00.000Z');

    expect(await camp.credentials.show(admin, child.id, 'admin@example.org')).toEqual({ kind: 'reissue' });
  });

  it('answers 404 when the person has no active badge', async () => {
    const camp = await createCamp();
    const { child } = await household(camp);
    expect(
      (await thrown(() => camp.credentials.show(camp.actor('admin'), child.id, 'admin@example.org'))).statusCode,
    ).toBe(404);
  });

  it('refuses to issue with a clear 503 when the badge key is missing, and revokes nothing', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const { child } = await household(camp);
    const before = await camp.credentials.issue(admin, child.id);

    const noKey = createCredentialService({
      credentials: camp.repos.credentials,
      people: camp.repos.people,
      memberships: camp.repos.memberships,
      attendance: camp.repos.attendance,
      orgs: camp.repos.orgs,
      clock: () => new Date('2027-07-10T12:00:00Z'),
      cipher: createBadgeCipher(() => parseBadgeKey(undefined)),
    });
    const failure = await thrown(() => noKey.issue(admin, child.id));
    expect(failure.statusCode).toBe(503);
    expect(failure.message).toContain('BADGE_ENCRYPTION_KEY');
    expect(failure.message).not.toContain(TEST_BADGE_KEY);
    expect(await camp.credentials.scan(admin, before.payload)).toMatchObject({ kind: 'person' });
  });

  it('lists the profile badges: a guardian sees their own and each child; a child sees only their own; a camp admin with no person record sees none', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const { guardian, child } = await household(camp);
    await camp.credentials.issue(admin, child.id);
    const gina = await signedIn(camp, 'guardian@example.org', 'viewer');
    const cal = await signedIn(camp, 'cal@example.org', 'viewer');

    const forGuardian = await camp.credentials.badgesFor(gina, 'guardian@example.org');
    expect(forGuardian.map(b => [b.personId, b.self, b.hasActiveBadge])).toEqual([
      [guardian.id, true, false],
      [child.id, false, true],
    ]);
    expect((await camp.credentials.badgesFor(cal, 'cal@example.org')).map(b => b.personId)).toEqual([child.id]);
    expect(await camp.credentials.badgesFor(admin, 'admin@example.org')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import type { Session } from '../../auth/session';
import { actorFor } from '../../auth/orgScope';
import { createOrgService } from '../orgs';
import { createCamp, type Camp } from './support';

/**
 * Team access expiry, in memory (the Postgres side is migration 0043 and packages/db/test/membership-expiry.test.ts).
 * An expired membership is no membership: the sign-in session does not list the camp, so the server refuses it the same way
 * it refuses a stranger. The owner rule and the audit rows match the database function.
 */

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

/** The session the sign-in path builds for this person: the same user row, and the memberships the database would return. */
async function sessionFor(camp: Camp, role: 'admin' | 'staff' | 'owner' | 'teacher' | 'viewer'): Promise<Session> {
  const user = await camp.store.upsertFromIdentity({
    authId: `${role}-user`,
    email: `${role}@example.org`,
    name: `${role} user`,
  });

  return { user, memberships: await camp.store.membershipsOf(user.id) };
}

function headersFor(orgId: string): Headers {
  return new Headers({ 'x-org-id': orgId });
}

describe('team access expiry (in memory)', () => {
  it('refuses an expired member on the server, exactly as a non-member', async () => {
    const camp = await createCamp();
    const staff = camp.actor('staff');
    const member = camp.store.members.find(m => m.userId === staff.userId);
    if (!member) {
      throw new Error('test setup: staff is a member');
    }
    member.expiresAt = PAST;

    const session = await sessionFor(camp, 'staff');
    expect(session.memberships.map(m => m.orgId)).not.toContain(camp.orgId);
    expect(() => actorFor(headersFor(camp.orgId), session)).toThrow('You do not have access to this organisation');
  });

  it('keeps access for an active member whose expiry is in the future', async () => {
    const camp = await createCamp();
    const member = camp.store.members.find(m => m.userId === camp.actor('staff').userId);
    if (!member) {
      throw new Error('test setup: staff is a member');
    }
    member.expiresAt = FUTURE;

    const session = await sessionFor(camp, 'staff');
    expect(actorFor(headersFor(camp.orgId), session).role).toBe('staff');
  });

  it('restores access when the expiry is cleared', async () => {
    const camp = await createCamp();
    const orgs = createOrgService(camp.store);
    const owner = camp.actor('owner');
    const staffId = camp.actor('staff').userId;
    await orgs.setMemberExpiry(owner, { userId: staffId, intent: 'set', expiresOn: '2020-01-01' });
    expect((await sessionFor(camp, 'staff')).memberships).toEqual([]);

    await orgs.setMemberExpiry(owner, { userId: staffId, intent: 'clear' });
    const session = await sessionFor(camp, 'staff');
    expect(actorFor(headersFor(camp.orgId), session).role).toBe('staff');
  });

  it('lets an admin set a non-owner expiry, and refuses an admin on an owner', async () => {
    const camp = await createCamp();
    const orgs = createOrgService(camp.store);
    const admin = camp.actor('admin');

    await orgs.setMemberExpiry(admin, { userId: camp.actor('staff').userId, intent: 'set', expiresOn: '2099-06-01' });
    const staff = camp.store.members.find(m => m.userId === camp.actor('staff').userId);
    expect(staff?.expiresAt).toBe('2099-06-01T00:00:00.000Z');

    await expect(
      orgs.setMemberExpiry(admin, { userId: camp.actor('owner').userId, intent: 'set', expiresOn: '2020-01-01' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('lets an owner set an owner expiry, and refuses a self change', async () => {
    const camp = await createCamp();
    const orgs = createOrgService(camp.store);
    const owner = camp.actor('owner');

    await expect(
      orgs.setMemberExpiry(owner, { userId: owner.userId, intent: 'set', expiresOn: '2099-06-01' }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const second = await camp.store.upsertFromIdentity({ authId: 'owner-two', email: 'o2@example.org', name: 'O Two' });
    camp.store.members.push({ orgId: camp.orgId, userId: second.id, role: 'owner' });
    await orgs.setMemberExpiry(owner, { userId: second.id, intent: 'set', expiresOn: '2099-06-01' });
    expect(camp.store.members.find(m => m.userId === second.id)?.expiresAt).toBe('2099-06-01T00:00:00.000Z');
  });

  it('writes member.expiry_set and member.expiry_clear audit rows with the from and to values', async () => {
    const camp = await createCamp();
    const orgs = createOrgService(camp.store);
    const admin = camp.actor('admin');
    const staffId = camp.actor('staff').userId;

    await orgs.setMemberExpiry(admin, { userId: staffId, intent: 'set', expiresOn: '2099-06-01' });
    await orgs.setMemberExpiry(admin, { userId: staffId, intent: 'clear' });

    const rows = camp.audit().filter(r => r.action.startsWith('member.expiry_'));
    expect(rows.map(r => r.action)).toEqual(['member.expiry_set', 'member.expiry_clear']);
    expect(rows[0]).toMatchObject({
      actorId: admin.userId,
      entity: 'member',
      entityId: staffId,
      data: { from: null, to: '2099-06-01T00:00:00.000Z' },
    });
    expect(rows[1]).toMatchObject({ data: { from: '2099-06-01T00:00:00.000Z', to: null } });
  });
});

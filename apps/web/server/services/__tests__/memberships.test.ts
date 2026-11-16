import { describe, expect, it } from 'vitest';
import { createCamp, thrown } from './support';

async function setup(start?: string) {
  const camp = await createCamp('UTC', start);
  const admin = camp.actor('admin');
  const ben = await camp.people.create(admin, { givenName: 'Ben', familyName: 'Stone', roles: ['participant'] });
  return { camp, admin, ben };
}

describe('MembershipService', () => {
  it('refuses add and revoke without memberships:manage (403)', async () => {
    const { camp, admin, ben } = await setup();
    const membership = await camp.memberships.add(admin, { personId: ben.id, plan: 'Summer', startsOn: '2027-07-01', endsOn: '2027-08-31' });
    expect((await thrown(() => camp.memberships.add(camp.actor('staff'), { personId: ben.id, plan: 'Summer', startsOn: '2027-07-01', endsOn: '2027-08-31' }))).statusCode).toBe(403);
    expect((await thrown(() => camp.memberships.revoke(camp.actor('staff'), { membershipId: membership.id, reason: 'Moved' }))).statusCode).toBe(403);
  });

  it('refuses an unknown person (404) and an end date before the start (400)', async () => {
    const { camp, admin, ben } = await setup();
    expect((await thrown(() => camp.memberships.add(admin, { personId: '00000000-0000-4000-8000-000000000000', plan: 'Summer', startsOn: '2027-07-01', endsOn: '2027-08-31' }))).statusCode).toBe(404);
    expect((await thrown(() => camp.memberships.add(admin, { personId: ben.id, plan: 'Summer', startsOn: '2027-08-31', endsOn: '2027-07-01' }))).statusCode).toBe(400);
  });

  it('computes the status for the camp\'s local day, and lists oldest start first', async () => {
    const { camp, admin, ben } = await setup();
    await camp.memberships.add(admin, { personId: ben.id, plan: 'August', startsOn: '2027-08-01', endsOn: '2027-08-31' });
    const summer = await camp.memberships.add(admin, { personId: ben.id, plan: 'July', startsOn: '2027-07-01', endsOn: '2027-07-31' });
    expect(summer.status).toBe('valid');
    const list = await camp.memberships.listFor(admin, ben.id);
    expect(list.map(m => [m.plan, m.status])).toEqual([['July', 'valid'], ['August', 'not_started']]);
  });

  it('marks a membership expired once its end date has passed in the camp zone', async () => {
    const { camp, admin, ben } = await setup('2027-07-31T23:30:00Z');
    await camp.memberships.add(admin, { personId: ben.id, plan: 'July', startsOn: '2027-07-01', endsOn: '2027-07-31' });
    // 23:30 UTC on the 31st is still the 31st in UTC, so the membership is still valid.
    expect((await camp.memberships.listFor(admin, ben.id))[0].status).toBe('valid');
    camp.at('2027-08-01T00:30:00Z');
    expect((await camp.memberships.listFor(admin, ben.id))[0].status).toBe('expired');
  });

  it('revoke needs a reason (400), records it, and keeps the first reason when repeated', async () => {
    const { camp, admin, ben } = await setup();
    const membership = await camp.memberships.add(admin, { personId: ben.id, plan: 'Summer', startsOn: '2027-07-01', endsOn: '2027-08-31' });
    expect((await thrown(() => camp.memberships.revoke(admin, { membershipId: membership.id, reason: '   ' }))).statusCode).toBe(400);

    const first = await camp.memberships.revoke(admin, { membershipId: membership.id, reason: 'Left early' });
    expect(first).toMatchObject({ status: 'revoked', revokedReason: 'Left early' });
    camp.at('2027-07-20T12:00:00Z');
    const second = await camp.memberships.revoke(admin, { membershipId: membership.id, reason: 'Something else' });
    expect(second.revokedReason).toBe('Left early');
    expect(camp.audit().filter(a => a.action === 'membership.revoke')).toHaveLength(1);
  });

  it('refuses an unknown membership on revoke (404) and an unknown person on list (404)', async () => {
    const { camp, admin } = await setup();
    expect((await thrown(() => camp.memberships.revoke(admin, { membershipId: '00000000-0000-4000-8000-000000000000', reason: 'x' }))).statusCode).toBe(404);
    expect((await thrown(() => camp.memberships.listFor(admin, '00000000-0000-4000-8000-000000000000'))).statusCode).toBe(404);
  });
});

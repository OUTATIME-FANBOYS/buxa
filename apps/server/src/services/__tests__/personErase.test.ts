import { describe, expect, it } from 'vitest';
import { createCamp, thrown } from './support';

/** Deleting a person is owner only (data:erase) and removes the person and their linked rows (memberships here). */
describe('PeopleService.erase (owner deletes a person)', () => {
  it('the owner deletes the person and their memberships, and the deletion is audited', async () => {
    const camp = await createCamp();
    const owner = camp.actor('owner');
    const admin = camp.actor('admin');
    const ana = await camp.people.create(admin, { givenName: 'Ana', familyName: 'Lee', roles: ['participant'] });
    await camp.repos.memberships.add(admin, {
      personId: ana.id,
      plan: 'Full week',
      startsOn: '2027-07-10',
      endsOn: '2027-07-17',
    });
    expect(await camp.repos.memberships.forPerson(admin.userId, camp.orgId, ana.id)).toHaveLength(1);

    await camp.people.erase(owner, ana.id);

    expect((await thrown(() => camp.people.get(owner, ana.id))).statusCode).toBe(404);
    expect(await camp.repos.memberships.forPerson(admin.userId, camp.orgId, ana.id)).toHaveLength(0);
    expect(camp.audit().some(row => row.action === 'person.delete' && row.entityId === ana.id)).toBe(true);
  });

  it('refuses an admin and staff (403) and leaves the person in place', async () => {
    const camp = await createCamp();
    const admin = camp.actor('admin');
    const ana = await camp.people.create(admin, { givenName: 'Ana', familyName: 'Lee', roles: ['participant'] });

    expect((await thrown(() => camp.people.erase(admin, ana.id))).statusCode).toBe(403);
    expect((await thrown(() => camp.people.erase(camp.actor('staff'), ana.id))).statusCode).toBe(403);
    expect(await camp.people.get(admin, ana.id)).toBeTruthy();
  });

  it('answers 404 for a person who is not in this camp', async () => {
    const camp = await createCamp();

    expect(
      (await thrown(() => camp.people.erase(camp.actor('owner'), '00000000-0000-4000-8000-000000000999'))).statusCode,
    ).toBe(404);
  });
});

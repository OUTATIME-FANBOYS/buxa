import { describe, expect, it } from 'vitest';
import { createCamp, thrown } from './support';
import { createOrgService } from '../orgs';

/**
 * A camp with a guardian, Ana, in the Lee family household, and a camper, Kim, in the same household. Ana has a membership and a
 * badge, so the custody fields have something real to hide. Gus is a second guardian in another household, not yet linked.
 */
async function family() {
  const camp = await createCamp();
  const admin = camp.actor('admin');
  const ana = await camp.people.create(admin, { givenName: 'Ana', familyName: 'Lee', roles: ['guardian'], newHouseholdName: 'Lee family', relationship: 'Mother' });
  const householdId = (await camp.people.get(admin, ana.id)).households[0].id;
  const kim = await camp.people.create(admin, { givenName: 'Kim', familyName: 'Lee', roles: ['camper'], householdId, relationship: 'Child', dateOfBirth: '2015-03-01' });
  const gus = await camp.people.create(admin, { givenName: 'Gus', familyName: 'Stone', roles: ['guardian'], newHouseholdName: 'Stone family', relationship: 'Father' });
  await camp.memberships.add(admin, { personId: ana.id, plan: 'Summer', startsOn: '2027-07-01', endsOn: '2027-08-31' });
  await camp.credentials.issue(admin, ana.id);
  return { camp, admin, ana, kim, gus, householdId };
}

describe('viewers do not get custody information (S-03)', () => {
  it('a viewer gets names and roles from a person view; memberships, pickup flags and badge status are withheld', async () => {
    const { camp, ana, householdId } = await family();
    const view = await camp.people.get(camp.actor('viewer'), ana.id);
    expect(view).toMatchObject({ givenName: 'Ana', familyName: 'Lee', roles: ['guardian'], memberships: null, hasActiveBadge: null, status: null, onSite: null });
    const member = view.households.find(h => h.id === householdId)?.members.find(m => m.personId === ana.id);
    expect(member).toEqual({ personId: ana.id, givenName: 'Ana', familyName: 'Lee', roles: ['guardian'], relationship: null, isGuardian: null, canPickup: null });
  });

  it('a viewer gets the same names but no custody fields in the people list and the household views', async () => {
    const { camp, householdId } = await family();
    const viewer = camp.actor('viewer');
    const [row] = (await camp.people.list(viewer, { query: 'Ana' }));
    expect(row).toMatchObject({ givenName: 'Ana', roles: ['guardian'], status: null, onSite: null });
    const [household] = await camp.people.listHouseholds(viewer);
    expect(household.id).toBe(householdId);
    for (const member of household.members) expect(member).toMatchObject({ relationship: null, isGuardian: null, canPickup: null });
    const single = await camp.people.getHousehold(viewer, householdId);
    expect(single.members.every(m => m.relationship === null && m.canPickup === null)).toBe(true);
  });

  it('staff and above still get memberships, the pickup flags and badge status', async () => {
    const { camp, admin, ana, householdId } = await family();
    const staffView = await camp.people.get(camp.actor('staff'), ana.id);
    expect(staffView).toMatchObject({ status: 'valid', hasActiveBadge: true, onSite: false });
    expect(staffView.memberships).toHaveLength(1);
    expect(staffView.households.find(h => h.id === householdId)?.members.find(m => m.personId === ana.id))
      .toMatchObject({ relationship: 'Mother', isGuardian: true, canPickup: false });
    expect((await camp.people.get(admin, ana.id)).hasActiveBadge).toBe(true);
  });
});

describe('pickup authorisation (S-04)', () => {
  it('a staff member cannot set canPickup on a link (403), and nothing changes', async () => {
    const { camp, admin, gus, householdId } = await family();
    await camp.people.linkToHousehold(admin, { householdId, personId: gus.id, relationship: 'Father', isGuardian: true, canPickup: false });
    const error = await thrown(() => camp.people.linkToHousehold(camp.actor('staff'), { householdId, personId: gus.id, relationship: 'Father', isGuardian: true, canPickup: true }));
    expect(error.statusCode).toBe(403);
    const after = (await camp.people.getHousehold(admin, householdId)).members.find(m => m.personId === gus.id);
    expect(after?.canPickup).toBe(false);
  });

  it('a staff member can still link a guardian who may not collect', async () => {
    const { camp, gus, householdId } = await family();
    const linked = await camp.people.linkToHousehold(camp.actor('staff'), { householdId, personId: gus.id, relationship: 'Father', isGuardian: true, canPickup: false });
    expect(linked.members.find(m => m.personId === gus.id)).toMatchObject({ isGuardian: true, canPickup: false });
  });

  it('a staff member cannot clear pickup from a guardian who has it (403); an admin can', async () => {
    const { camp, admin, ana, householdId } = await family();
    await camp.people.linkToHousehold(admin, { householdId, personId: ana.id, relationship: 'Mother', isGuardian: true, canPickup: true });
    const error = await thrown(() => camp.people.linkToHousehold(camp.actor('staff'), { householdId, personId: ana.id, relationship: 'Mother', isGuardian: true, canPickup: false }));
    expect(error.statusCode).toBe(403);
    const cleared = await camp.people.linkToHousehold(admin, { householdId, personId: ana.id, relationship: 'Mother', isGuardian: true, canPickup: false });
    expect(cleared.members.find(m => m.personId === ana.id)?.canPickup).toBe(false);
  });

  it('an admin can authorise pickup, and the audit entry records the pickup flags', async () => {
    const { camp, admin, gus, householdId } = await family();
    const linked = await camp.people.linkToHousehold(admin, { householdId, personId: gus.id, relationship: 'Father', isGuardian: true, canPickup: true });
    expect(linked.members.find(m => m.personId === gus.id)).toMatchObject({ canPickup: true });
    const entry = camp.audit().filter(a => a.action === 'household.update').at(-1);
    expect(entry?.data).toEqual({ personId: gus.id, isGuardian: true, canPickup: true });
  });
});

describe('staff email addresses (S-08)', () => {
  it('shows email to admins and above only; viewers and staff get names and roles', async () => {
    const { camp } = await family();
    const orgs = createOrgService(camp.repos.orgs);
    const asViewer = await orgs.listMembers(camp.actor('viewer'));
    const asStaff = await orgs.listMembers(camp.actor('staff'));
    expect(asViewer.members.every(m => m.email === null)).toBe(true);
    expect(asStaff.members.every(m => m.email === null)).toBe(true);
    expect(asViewer.members.map(m => m.role).sort()).toEqual(['admin', 'owner', 'staff', 'viewer']);
    const asAdmin = await orgs.listMembers(camp.actor('admin'));
    expect(asAdmin.members.find(m => m.role === 'staff')?.email).toBe('staff@example.org');
  });
});

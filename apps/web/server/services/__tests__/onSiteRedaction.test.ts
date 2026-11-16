import { describe, expect, it } from 'vitest';
import { createCamp } from './support';

/** Staff and a viewer see the same on-site list; only staff see minor status and pickup options. */
describe('AttendanceService on-site redaction', () => {
  it('withholds minor status and pickup options from a viewer, and shows them to staff', async () => {
    const camp = await createCamp('UTC', '2027-07-10T09:00:00Z');
    const admin = camp.actor('admin');
    const staff = camp.actor('staff');
    const viewer = camp.actor('viewer');
    const ana = await camp.people.create(admin, { givenName: 'Ana', familyName: 'Lee', roles: ['guardian'], newHouseholdName: 'Lee family', relationship: 'Mother' });
    const householdId = (await camp.people.get(admin, ana.id)).households[0].id;
    await camp.people.linkToHousehold(admin, { householdId, personId: ana.id, relationship: 'Mother', isGuardian: true, canPickup: true });
    const kim = await camp.people.create(admin, { givenName: 'Kim', familyName: 'Lee', roles: ['camper'], householdId, relationship: 'Child', dateOfBirth: '2015-03-01' });
    const ben = await camp.people.create(admin, { givenName: 'Ben', familyName: 'Stone', roles: ['participant'], dateOfBirth: '1990-04-02' });
    for (const person of [ana, kim, ben]) {
      await camp.memberships.add(admin, { personId: person.id, plan: 'Summer', startsOn: '2027-07-01', endsOn: '2027-08-31' });
    }
    await camp.attendance.checkIn(staff, { personId: ben.id, method: 'qr' });
    camp.at('2027-07-10T10:30:00Z');
    await camp.attendance.checkIn(staff, { personId: kim.id, method: 'qr' });

    const asViewer = await camp.attendance.onSite(viewer);
    expect(asViewer.map(row => row.person.givenName)).toEqual(['Ben', 'Kim']);
    expect(asViewer.map(row => row.isMinor)).toEqual([null, null]);
    expect(asViewer[1].pickupOptions).toEqual([]);

    const asStaff = await camp.attendance.onSite(staff);
    expect(asStaff.map(row => row.isMinor)).toEqual([false, true]);
    expect(asStaff[1].pickupOptions).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { createCamp, thrown, type Camp } from './support';

const NOT_FOUND_ID = '00000000-0000-4000-8000-000000000000';
const FILTER = { from: '2027-07-10', to: '2027-07-10' } as const;

/**
 * A camp with a family and two adults: Kim (camper, 12) in the Lee family household, whose guardian Ana may collect and whose
 * other guardian Gus may not. Ben is an adult with a valid membership. Zed has never had a membership.
 */
async function build(timeZone = 'UTC') {
  const camp: Camp = await createCamp(timeZone, '2027-07-10T09:00:00Z');
  const admin = camp.actor('admin');
  const ana = await camp.people.create(admin, { givenName: 'Ana', familyName: 'Lee', roles: ['guardian'], newHouseholdName: 'Lee family', relationship: 'Mother' });
  const householdId = (await camp.people.get(admin, ana.id)).households[0].id;
  await camp.people.linkToHousehold(admin, { householdId, personId: ana.id, relationship: 'Mother', isGuardian: true, canPickup: true });
  const gus = await camp.people.create(admin, { givenName: 'Gus', familyName: 'Lee', roles: ['guardian'], householdId, relationship: 'Father' });
  const kim = await camp.people.create(admin, { givenName: 'Kim', familyName: 'Lee', roles: ['camper'], householdId, relationship: 'Child', dateOfBirth: '2015-03-01' });
  const ben = await camp.people.create(admin, { givenName: 'Ben', familyName: 'Stone', roles: ['participant'], dateOfBirth: '1990-04-02' });
  const zed = await camp.people.create(admin, { givenName: 'Zed', familyName: 'Zero', roles: ['participant'] });
  for (const person of [ana, gus, kim, ben]) {
    await camp.memberships.add(admin, { personId: person.id, plan: 'Summer', startsOn: '2027-07-01', endsOn: '2027-08-31' });
  }
  return { camp, admin, staff: camp.actor('staff'), viewer: camp.actor('viewer'), ids: { ana: ana.id, gus: gus.id, kim: kim.id, ben: ben.id, zed: zed.id } };
}

describe('AttendanceService permissions', () => {
  it('refuses check-in to a viewer (403), and the export to staff (403)', async () => {
    const { camp, viewer, staff, ids } = await build();
    expect((await thrown(() => camp.attendance.checkIn(viewer, { personId: ids.ben, method: 'manual' }))).statusCode).toBe(403);
    expect((await thrown(() => camp.attendance.exportCsv(staff, FILTER))).statusCode).toBe(403);
    expect((await thrown(() => camp.attendance.exportCsv(viewer, FILTER))).statusCode).toBe(403);
  });

  it('lets a viewer read the log and the on-site list', async () => {
    const { camp, staff, viewer, ids } = await build();
    await camp.attendance.checkIn(staff, { personId: ids.ben, method: 'qr' });
    expect(await camp.attendance.log(viewer, FILTER)).toHaveLength(1);
    expect(await camp.attendance.onSite(viewer)).toHaveLength(1);
  });

  it('answers a staff override with not-valid (canOverride false), because only admins may override', async () => {
    const { camp, staff, ids } = await build();
    const result = await camp.attendance.checkIn(staff, { personId: ids.zed, method: 'manual', overrideReason: 'Paid at the gate' });
    expect(result).toEqual({ ok: false, reason: 'not_valid', status: 'none', canOverride: false });
  });
});

describe('AttendanceService check-in', () => {
  it('checks a valid person in, naming the staff member', async () => {
    const { camp, staff, ids } = await build();
    const result = await camp.attendance.checkIn(staff, { personId: ids.ben, method: 'qr' });
    expect(result).toMatchObject({ ok: true, overridden: false, entry: { personName: 'Ben Stone', checkedInByName: 'Staff User', method: 'qr', checkedOutAt: null } });
  });

  it('refuses a second check-in while on site, with the arrival time', async () => {
    const { camp, staff, ids } = await build();
    const first = await camp.attendance.checkIn(staff, { personId: ids.ben, method: 'qr' });
    if (!first.ok) throw new Error('expected a check-in');
    camp.at('2027-07-10T10:00:00Z');
    expect(await camp.attendance.checkIn(staff, { personId: ids.ben, method: 'qr' })).toEqual({ ok: false, reason: 'already_on_site', since: first.entry.checkedInAt });
  });

  it('refuses a person with no valid membership, and says why', async () => {
    const { camp, admin, ids } = await build();
    expect(await camp.attendance.checkIn(admin, { personId: ids.zed, method: 'manual' })).toEqual({ ok: false, reason: 'not_valid', status: 'none', canOverride: true });
  });

  it('needs a reason for an admin override, and records it when given', async () => {
    const { camp, admin, ids } = await build();
    expect(await camp.attendance.checkIn(admin, { personId: ids.zed, method: 'manual', overrideReason: '   ' })).toEqual({ ok: false, reason: 'override_needs_reason' });
    const result = await camp.attendance.checkIn(admin, { personId: ids.zed, method: 'manual', overrideReason: 'Paid at the gate' });
    expect(result).toMatchObject({ ok: true, overridden: true, entry: { overrideReason: 'Paid at the gate' } });
    expect(camp.audit().map(a => a.action)).toEqual(expect.arrayContaining(['attendance.check_in', 'attendance.override']));
  });

  it('refuses an archived person', async () => {
    const { camp, admin, staff, ids } = await build();
    await camp.people.archive(admin, ids.zed);
    expect(await camp.attendance.checkIn(staff, { personId: ids.zed, method: 'manual' })).toEqual({ ok: false, reason: 'archived' });
  });
});

describe('AttendanceService check-out', () => {
  it('needs an authorised guardian for a child, and lists who may collect', async () => {
    const { camp, staff, ids } = await build();
    await camp.attendance.checkIn(staff, { personId: ids.kim, method: 'qr' });

    expect(await camp.attendance.checkOut(staff, { personId: ids.kim })).toEqual({
      ok: false, reason: 'pickup_required', canOverride: false, guardians: [{ personId: ids.ana, name: 'Ana Lee', relationship: 'Mother' }],
    });
    expect(await camp.attendance.checkOut(staff, { personId: ids.kim, collectedByPersonId: ids.gus })).toEqual({
      ok: false, reason: 'pickup_not_authorised', canOverride: false, guardians: [{ personId: ids.ana, name: 'Ana Lee', relationship: 'Mother' }],
    });
  });

  it('checks the child out with an authorised guardian, then refuses a second check-out', async () => {
    const { camp, staff, ids } = await build();
    await camp.attendance.checkIn(staff, { personId: ids.kim, method: 'qr' });
    camp.at('2027-07-10T16:00:00Z');
    const result = await camp.attendance.checkOut(staff, { personId: ids.kim, collectedByPersonId: ids.ana });
    expect(result).toMatchObject({ ok: true, overridden: false, entry: { collectedByName: 'Ana Lee', checkedOutByName: 'Staff User' } });
    expect(await camp.attendance.checkOut(staff, { personId: ids.kim, collectedByPersonId: ids.ana })).toEqual({ ok: false, reason: 'not_on_site' });
  });

  it('lets an admin override with a reason, and refuses a blank one', async () => {
    const { camp, admin, staff, ids } = await build();
    await camp.attendance.checkIn(staff, { personId: ids.kim, method: 'qr' });
    expect(await camp.attendance.checkOut(admin, { personId: ids.kim, overrideReason: '  ' })).toEqual({ ok: false, reason: 'override_needs_reason' });
    expect(await camp.attendance.checkOut(staff, { personId: ids.kim, overrideReason: 'Parent on the phone' })).toMatchObject({ ok: false, reason: 'pickup_required', canOverride: false });

    const result = await camp.attendance.checkOut(admin, { personId: ids.kim, overrideReason: 'Parent on the phone' });
    expect(result).toMatchObject({ ok: true, overridden: true, entry: { overrideReason: 'Parent on the phone' } });
  });

  it('lets an adult leave without a collector', async () => {
    const { camp, staff, ids } = await build();
    await camp.attendance.checkIn(staff, { personId: ids.ben, method: 'qr' });
    expect(await camp.attendance.checkOut(staff, { personId: ids.ben })).toMatchObject({ ok: true, overridden: false });
  });

  it('refuses a check-out for someone not on site', async () => {
    const { camp, staff, ids } = await build();
    expect(await camp.attendance.checkOut(staff, { personId: ids.ben })).toEqual({ ok: false, reason: 'not_on_site' });
  });
});

describe('AttendanceService on-site, log, history and export', () => {
  it('lists people on site oldest arrival first, with pickup options for children', async () => {
    const { camp, staff, ids } = await build();
    await camp.attendance.checkIn(staff, { personId: ids.ben, method: 'qr' });
    camp.at('2027-07-10T10:30:00Z');
    await camp.attendance.checkIn(staff, { personId: ids.kim, method: 'qr' });

    const onSite = await camp.attendance.onSite(staff);
    expect(onSite.map(row => row.person.givenName)).toEqual(['Ben', 'Kim']);
    expect(onSite[0]).toMatchObject({ isMinor: false, pickupOptions: [] });
    expect(onSite[1]).toMatchObject({ isMinor: true, pickupOptions: [{ personId: ids.ana, name: 'Ana Lee', relationship: 'Mother' }] });
    expect(onSite[1].person).toMatchObject({ onSite: true, status: 'valid' });
  });

  it('returns the log newest first, filtered by camp-local day and person', async () => {
    const { camp, staff, ids } = await build();
    await camp.attendance.checkIn(staff, { personId: ids.ben, method: 'qr' });
    camp.at('2027-07-10T11:00:00Z');
    await camp.attendance.checkIn(staff, { personId: ids.kim, method: 'qr' });

    expect((await camp.attendance.log(staff, FILTER)).map(e => e.personName)).toEqual(['Kim Lee', 'Ben Stone']);
    expect((await camp.attendance.log(staff, { ...FILTER, personId: ids.ben })).map(e => e.personName)).toEqual(['Ben Stone']);
    expect(await camp.attendance.log(staff, { from: '2027-07-11', to: '2027-07-11' })).toEqual([]);
  });

  it('counts the camp\'s local day, not UTC: a visit after midnight in Auckland is the next day', async () => {
    const { camp, staff, ids } = await build('Pacific/Auckland');
    // 12:00 UTC on 10 July is 00:00 on 11 July in Auckland (winter time, UTC+12).
    camp.at('2027-07-10T12:00:00Z');
    await camp.attendance.checkIn(staff, { personId: ids.ben, method: 'qr' });
    expect(await camp.attendance.log(staff, { from: '2027-07-11', to: '2027-07-11' })).toHaveLength(1);
    expect(await camp.attendance.log(staff, { from: '2027-07-10', to: '2027-07-10' })).toHaveLength(0);
  });

  it('returns one person\'s visits newest first, and 404 for an unknown person', async () => {
    const { camp, staff, ids } = await build();
    await camp.attendance.checkIn(staff, { personId: ids.kim, method: 'qr' });
    await camp.attendance.checkOut(staff, { personId: ids.kim, collectedByPersonId: ids.ana });
    camp.at('2027-07-10T13:00:00Z');
    await camp.attendance.checkIn(staff, { personId: ids.kim, method: 'qr' });
    const visits = await camp.attendance.history(staff, ids.kim);
    expect(visits).toHaveLength(2);
    expect(visits[0].checkedOutAt).toBeNull();
    expect(visits[1].checkedOutByName).toBe('Staff User');
    expect((await thrown(() => camp.attendance.history(staff, NOT_FOUND_ID))).statusCode).toBe(404);
  });

  it('exports CSV with a header, CRLF rows, no byte-order mark, newest first, and neutralised formulas', async () => {
    const { camp, admin, staff, ids } = await build();
    await camp.attendance.checkIn(staff, { personId: ids.ben, method: 'qr', note: '=1+1, "quoted"' });
    camp.at('2027-07-10T11:00:00Z');
    await camp.attendance.checkIn(staff, { personId: ids.kim, method: 'qr' });

    const csv = await camp.attendance.exportCsv(admin, FILTER);
    expect(csv.startsWith('﻿')).toBe(false);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Person,Checked in,Checked in by,Method,Checked out,Checked out by,Collected by,Override reason,Note');
    expect(lines[1].startsWith('Kim Lee,')).toBe(true);
    expect(lines[2].startsWith('Ben Stone,')).toBe(true);
    expect(lines[2]).toContain('"\'=1+1, ""quoted"""');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

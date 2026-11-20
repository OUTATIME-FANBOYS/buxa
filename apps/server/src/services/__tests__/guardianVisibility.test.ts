import { describe, expect, it } from 'vitest';
import type { Actor } from '@buxa/domain';
import { createClassService } from '../../classes/ClassService';
import type { InMemoryClassRepository } from '../../classes/InMemoryClassRepository';
import { JULY_SESSION, robotics } from '../../classes/__tests__/fixtures';
import { createCamp, type Camp } from './support';

// A teacher checks campers in only with the per-person option an admin turns on (MEMBER_OPTIONS). These tests are about what a
// teacher may see once it can check in, so the option is on here; without it check-in is refused (teacherScope.test.ts).
const withCheckIn = (actor: Actor): Actor => ({ ...actor, options: ['teacher.check_in_out'] });

/*
 * Guardian names are custody information. A teacher sees its campers and their ages, never a guardian's name: not in pick-up
 * options, not in a refused check-out, not as who collected a child, not in a household. Staff and above still see all of it.
 */

const FILTER = { from: '2027-07-10', to: '2027-07-10' } as const;

async function build() {
  const camp: Camp = await createCamp('UTC', '2027-07-10T09:00:00Z');
  const admin = camp.actor('admin');
  const teacher = withCheckIn(camp.actor('teacher'));
  const staff = camp.actor('staff');
  const store = camp.repos.classes as InMemoryClassRepository;
  const classes = createClassService({ repo: camp.repos.classes, timezoneOf: () => Promise.resolve('UTC') });

  const ana = await camp.people.create(admin, {
    givenName: 'Ana',
    familyName: 'Lee',
    roles: ['guardian'],
    newHouseholdName: 'Lee family',
    relationship: 'Mother',
  });
  const householdId = (await camp.people.get(admin, ana.id)).households[0].id;
  await camp.people.linkToHousehold(admin, {
    householdId,
    personId: ana.id,
    relationship: 'Mother',
    isGuardian: true,
    canPickup: true,
  });
  const gus = await camp.people.create(admin, {
    givenName: 'Gus',
    familyName: 'Lee',
    roles: ['guardian'],
    householdId,
    relationship: 'Father',
  });
  const kim = await camp.people.create(admin, {
    givenName: 'Kim',
    familyName: 'Lee',
    roles: ['camper'],
    householdId,
    relationship: 'Child',
    dateOfBirth: '2015-03-01',
  });
  for (const p of [ana, gus, kim]) {
    await camp.memberships.add(admin, { personId: p.id, plan: 'Summer', startsOn: '2027-07-01', endsOn: '2027-08-31' });
  }
  store.seedCamper(camp.orgId, kim.id, 'Kim', '2015-03-01');

  const session = await classes.createSession(admin, JULY_SESSION);
  if (!session.ok) {
    throw new Error('session');
  }
  const added = await classes.addClass(admin, session.value.id, {
    ...robotics,
    startsAt: '2027-07-10T09:00:00Z',
    endsAt: '2027-07-10T12:00:00Z',
  });
  if (!added.ok) {
    throw new Error(added.failure.message);
  }
  if (!(await classes.enrol(admin, { classId: added.value.id, camperId: kim.id, waitlistIfFull: false })).ok) {
    throw new Error('enrol');
  }
  expect((await classes.setTeachers(admin, added.value.id, [teacher.userId])).ok).toBe(true);

  return { camp, teacher, staff, kim, ana, gus, householdId };
}

describe('guardian names are withheld from a teacher', () => {
  it('a refused check-out names no guardian to a teacher, but lists the pick-up guardians to staff', async () => {
    const { camp, teacher, staff, kim, gus } = await build();
    expect((await camp.attendance.checkIn(teacher, { personId: kim.id, method: 'manual' })).ok).toBe(true);

    const asTeacher = await camp.attendance.checkOut(teacher, { personId: kim.id, collectedByPersonId: gus.id });
    expect(asTeacher).toMatchObject({ ok: false, guardians: [] });
    expect(JSON.stringify(asTeacher)).not.toContain('Ana');

    const asStaff = await camp.attendance.checkOut(staff, { personId: kim.id, collectedByPersonId: gus.id });
    expect(asStaff).toMatchObject({ ok: false, guardians: [{ name: 'Ana Lee', relationship: 'Mother' }] });
  });

  it('on site, a teacher gets no pick-up options for a camper; staff get them', async () => {
    const { camp, teacher, staff, kim } = await build();
    await camp.attendance.checkIn(teacher, { personId: kim.id, method: 'manual' });

    const asTeacher = await camp.attendance.onSite(teacher);
    expect(asTeacher.map(e => e.pickupOptions)).toEqual([[]]);
    expect(JSON.stringify(asTeacher)).not.toContain('Ana');
    expect(JSON.stringify(asTeacher)).not.toContain('Gus');

    const asStaff = await camp.attendance.onSite(staff);
    expect(asStaff[0].pickupOptions.map(o => o.name)).toEqual(['Ana Lee']);
  });

  it('a log entry names no collector to a teacher; staff see who collected the child', async () => {
    const { camp, teacher, staff, kim, ana } = await build();
    await camp.attendance.checkIn(teacher, { personId: kim.id, method: 'manual' });
    expect((await camp.attendance.checkOut(staff, { personId: kim.id, collectedByPersonId: ana.id })).ok).toBe(true);

    const asTeacher = await camp.attendance.log(teacher, FILTER);
    expect(asTeacher.map(e => e.collectedByName)).toEqual([null]);
    expect(JSON.stringify(asTeacher)).not.toContain('Ana');

    const asStaff = await camp.attendance.log(staff, FILTER);
    expect(asStaff.map(e => e.collectedByName)).toEqual(['Ana Lee']);
  });

  it('a teacher gets no household for a camper; staff get the household with its guardians', async () => {
    const { camp, teacher, staff, kim } = await build();

    const asTeacher = await camp.people.get(teacher, kim.id);
    expect(asTeacher.households).toEqual([]);
    expect(JSON.stringify(asTeacher)).not.toContain('Ana');
    expect(JSON.stringify(asTeacher)).not.toContain('Gus');

    const asStaff = await camp.people.get(staff, kim.id);
    const names = asStaff.households.flatMap(h => h.members.map(m => `${m.givenName} ${m.familyName}`));
    expect(names).toEqual(expect.arrayContaining(['Ana Lee', 'Gus Lee']));
  });
});

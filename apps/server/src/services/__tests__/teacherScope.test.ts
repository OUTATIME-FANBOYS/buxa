import { describe, expect, it } from 'vitest';
import type { Actor } from '@buxa/domain';
import { createClassService } from '../../classes/ClassService';
import type { InMemoryClassRepository } from '../../classes/InMemoryClassRepository';
import type { InMemoryGroupRepository } from '../../groups/InMemoryGroupRepository';
import { painting, robotics, JULY_SESSION } from '../../classes/__tests__/fixtures';
import { createCamp, linkTeacher, thrown, type Camp } from './support';

// A teacher checks campers in only with the per-person option an admin turns on (MEMBER_OPTIONS). These tests are about what a
// teacher may see once it can check in, so the option is on here; without it check-in is refused (teacherScope.test.ts).
const withCheckIn = (actor: Actor): Actor => ({ ...actor, options: ['teacher.check_in_out'] });

/*
 * The assigned-classes scope, enforced in the services (not only hidden in the UI). Camp: Kim and Lia are in Robotics (assigned
 * to the teacher); Mo is in Painting (not assigned); Ned is in no class. Every refusal is a 403 with no data.
 */

const FILTER = { from: '2027-07-10', to: '2027-07-10' } as const;
const ROBOTICS_TIMES = { startsAt: '2027-07-10T09:00:00Z', endsAt: '2027-07-10T12:00:00Z' };
const PAINTING_TIMES = { startsAt: '2027-07-10T13:00:00Z', endsAt: '2027-07-10T15:00:00Z' };

async function build() {
  const camp: Camp = await createCamp('UTC', '2027-07-10T09:00:00Z');
  const admin = camp.actor('admin');
  const teacher = withCheckIn(camp.actor('teacher'));
  const staff = camp.actor('staff');
  const viewer = camp.actor('viewer');
  const classes = createClassService({ repo: camp.repos.classes, timezoneOf: () => Promise.resolve('UTC') });

  const adult = (givenName: string) =>
    camp.people.create(admin, {
      dateOfBirth: '1985-06-15',
      phone: '+1 555 0100',
      givenName,
      familyName: 'Camp',
      roles: ['participant'],
    });
  const kim = await adult('Kim');
  const lia = await adult('Lia');
  const mo = await adult('Mo');
  const ned = await adult('Ned');
  const store = camp.repos.classes as InMemoryClassRepository;
  for (const p of [kim, lia, mo, ned]) {
    await camp.memberships.add(admin, { personId: p.id, plan: 'Summer', startsOn: '2027-07-01', endsOn: '2027-08-31' });
    store.seedCamper(camp.orgId, p.id, p.givenName, '2015-03-01');
  }

  const session = await classes.createSession(admin, JULY_SESSION);
  if (!session.ok) {
    throw new Error('session');
  }
  await classes.publishSession(admin, session.value.id);
  // Check-in reads a session's assignments from the group store, which keeps its own copy of sessions.
  (camp.repos.groups as InMemoryGroupRepository).seedSession({
    id: session.value.id,
    orgId: camp.orgId,
    name: JULY_SESSION.name,
    startsOn: JULY_SESSION.startsOn,
    endsOn: JULY_SESSION.endsOn,
  });
  const addClass = async (cls: typeof robotics, times: typeof ROBOTICS_TIMES, instructorIds: string[] = []) => {
    const added = await classes.addClass(admin, session.value.id, { ...cls, ...times, instructorIds });
    if (!added.ok) {
      throw new Error(added.failure.message);
    }

    return added.value.id;
  };
  const teacherPersonId = await linkTeacher(camp, teacher.userId);
  const roboticsId = await addClass(robotics, ROBOTICS_TIMES, [teacherPersonId]);
  const paintingId = await addClass(painting, PAINTING_TIMES);
  for (const [classId, camperId] of [
    [roboticsId, kim.id],
    [roboticsId, lia.id],
    [paintingId, mo.id],
  ] as const) {
    const r = await classes.enrol(admin, { classId, camperId, waitlistIfFull: false });
    if (!r.ok) {
      throw new Error(r.failure.message);
    }
  }

  return {
    camp,
    admin,
    teacher,
    staff,
    viewer,
    classes,
    sessionId: session.value.id,
    roboticsId,
    paintingId,
    kim,
    lia,
    mo,
    ned,
  };
}

describe('teacher: attendance is limited to its classes', () => {
  it('without the check-in option a teacher is refused check-in, even in its own class', async () => {
    const { camp, kim } = await build();
    const plain = camp.actor('teacher');
    expect(
      (await thrown(() => camp.attendance.checkIn(plain, { personId: kim.id, method: 'manual' }))).statusCode,
    ).toBe(403);
  });

  it('checks in and out its own campers', async () => {
    const { camp, teacher, kim, sessionId } = await build();
    expect((await camp.attendance.checkIn(teacher, { personId: kim.id, method: 'manual', sessionId })).ok).toBe(true);
    expect((await camp.attendance.checkOut(teacher, { personId: kim.id })).ok).toBe(true);
  });

  it('is refused check-in and check-out of a camper in another class, or in no class (403)', async () => {
    const { camp, teacher, mo, ned } = await build();
    for (const person of [mo, ned]) {
      expect(
        (await thrown(() => camp.attendance.checkIn(teacher, { personId: person.id, method: 'manual' }))).statusCode,
      ).toBe(403);
      expect((await thrown(() => camp.attendance.checkOut(teacher, { personId: person.id }))).statusCode).toBe(403);
    }
  });

  it('lists only its own campers on site and in the log', async () => {
    const { camp, teacher, staff, kim, mo, sessionId } = await build();
    await camp.attendance.checkIn(teacher, { personId: kim.id, method: 'manual', sessionId });
    await camp.attendance.checkIn(staff, { personId: mo.id, method: 'manual', sessionId });

    expect((await camp.attendance.onSite(teacher)).map(e => e.person.id)).toEqual([kim.id]);
    expect((await camp.attendance.onSite(staff)).map(e => e.person.id).sort()).toEqual([kim.id, mo.id].sort());
    expect((await camp.attendance.log(teacher, FILTER)).map(e => e.personId)).toEqual([kim.id]);
  });

  it('refuses another camper history (403) and shows its own', async () => {
    const { camp, teacher, kim, mo, sessionId } = await build();
    await camp.attendance.checkIn(teacher, { personId: kim.id, method: 'manual', sessionId });
    expect((await camp.attendance.history(teacher, kim.id)).length).toBe(1);
    expect((await thrown(() => camp.attendance.history(teacher, mo.id))).statusCode).toBe(403);
  });

  it('is refused the export and overrides (no attendance:export or attendance:override)', async () => {
    const { camp, teacher } = await build();
    const request = {
      filter: FILTER,
      fields: ['person'] as const,
      display: { timeZone: 'UTC', clockFormat: '24h' } as const,
    };
    expect((await thrown(() => camp.attendance.exportCsv(teacher, request))).statusCode).toBe(403);
  });
});

describe('teacher: people and classes are limited to its classes, read-only', () => {
  it('lists only the campers in its classes and refuses the others by id', async () => {
    const { camp, teacher, kim, lia, mo } = await build();
    expect((await camp.people.list(teacher)).map(p => p.id).sort()).toEqual([kim.id, lia.id].sort());
    expect((await camp.people.get(teacher, kim.id)).id).toBe(kim.id);
    expect((await thrown(() => camp.people.get(teacher, mo.id))).statusCode).toBe(403);
  });

  it('is refused households (they name people outside its classes) and every edit to people', async () => {
    const { camp, teacher, kim } = await build();
    expect((await thrown(() => camp.people.listHouseholds(teacher))).statusCode).toBe(403);
    expect((await thrown(() => camp.people.update(teacher, kim.id, { givenName: 'X' }))).statusCode).toBe(403);
  });

  it('sees its sessions, its classes and their campers, and nothing of other classes', async () => {
    const { classes, teacher, sessionId, roboticsId, paintingId, kim, lia } = await build();
    const sessions = await classes.listSessions(teacher);
    expect(sessions.ok && sessions.value.map(s => s.id)).toEqual([sessionId]);
    const mine = await classes.listClasses(teacher, sessionId);
    expect(mine.ok && mine.value.map(c => c.id)).toEqual([roboticsId]);
    expect((await classes.getClass(teacher, roboticsId)).ok).toBe(true);
    expect((await thrown(() => classes.getClass(teacher, paintingId))).statusCode).toBe(403);
    expect((await thrown(() => classes.listEnrolments(teacher, paintingId))).statusCode).toBe(403);
    const roster = await classes.listEnrolments(teacher, roboticsId);
    expect(roster.ok && roster.value.map(e => e.camperId).sort()).toEqual([kim.id, lia.id].sort());
  });

  it('is refused every class change', async () => {
    const { classes, teacher, roboticsId } = await build();
    const changed = await classes.updateClass(teacher, roboticsId, { ...robotics, ...ROBOTICS_TIMES, capacity: 9 });
    expect(changed).toMatchObject({ ok: false, failure: { reason: 'teacher_field_refused' } });
    expect((await thrown(() => classes.deleteClass(teacher, roboticsId))).statusCode).toBe(403);
  });

  it('loses its scope when the class no longer names its linked person as an instructor', async () => {
    const { classes, admin, teacher, sessionId, roboticsId, camp, kim } = await build();
    expect(
      (await classes.updateClass(admin, roboticsId, { ...robotics, ...ROBOTICS_TIMES, instructorIds: [] })).ok,
    ).toBe(true);
    const mine = await classes.listClasses(teacher, sessionId);
    expect(mine.ok && mine.value).toEqual([]);
    expect(
      (await thrown(() => camp.attendance.checkIn(teacher, { personId: kim.id, method: 'manual' }))).statusCode,
    ).toBe(403);
  });
});

describe('teacher: other camps', () => {
  it("a teacher of another camp is refused this camp's classes (no assignment here, so 403)", async () => {
    const { classes, roboticsId } = await build();
    const other = await createCamp('UTC', '2027-07-10T09:00:00Z');
    expect((await thrown(() => classes.getClass(other.actor('teacher'), roboticsId))).statusCode).toBe(403);
  });
});

import { describe, expect, it } from 'vitest';
import type { Actor } from '@buxa/domain';
import { createClassService } from '../../classes/ClassService';
import type { InMemoryClassRepository } from '../../classes/InMemoryClassRepository';
import { painting, robotics, JULY_SESSION } from '../../classes/__tests__/fixtures';
import { createCamp, type Camp } from './support';

/*
 * "My classes": a teacher sees its own assigned classes, grouped by session, and nothing else. Camp: Robotics (July) and Coding
 * (August) are assigned to the teacher; Painting (July) is assigned to a second teacher. Staff have no classes on this page.
 */

const ROBOTICS_TIMES = { startsAt: '2027-07-10T09:00:00Z', endsAt: '2027-07-10T12:00:00Z' };
const PAINTING_TIMES = { startsAt: '2027-07-10T13:00:00Z', endsAt: '2027-07-10T15:00:00Z' };
const CODING_TIMES = { startsAt: '2027-08-02T13:00:00Z', endsAt: '2027-08-02T15:00:00Z' };

async function build() {
  const camp: Camp = await createCamp('UTC', '2027-07-10T09:00:00Z');
  const admin = camp.actor('admin');
  const teacher: Actor = camp.actor('teacher');
  const staff = camp.actor('staff');
  const store = camp.repos.classes as InMemoryClassRepository;
  store.seedTeacher(camp.orgId, 'teacher-two');
  const otherTeacher: Actor = { userId: 'teacher-two', orgId: camp.orgId, role: 'teacher' };
  const classes = createClassService({ repo: camp.repos.classes, timezoneOf: () => Promise.resolve('UTC') });

  const july = await classes.createSession(admin, JULY_SESSION);
  const august = await classes.createSession(admin, {
    ...JULY_SESSION,
    name: 'August camp',
    startsOn: '2027-08-01',
    endsOn: '2027-08-14',
  });
  if (!july.ok || !august.ok) {
    throw new Error('session');
  }
  const addClass = async (cls: typeof robotics, sessionId: string, times: typeof ROBOTICS_TIMES) => {
    const added = await classes.addClass(admin, sessionId, { ...cls, ...times });
    if (!added.ok) {
      throw new Error(added.failure.message);
    }

    return added.value.id;
  };
  const roboticsId = await addClass(robotics, july.value.id, ROBOTICS_TIMES);
  const codingId = await addClass({ ...robotics, name: 'Coding' }, august.value.id, CODING_TIMES);
  const paintingId = await addClass(painting, july.value.id, PAINTING_TIMES);
  expect((await classes.setTeachers(admin, roboticsId, [teacher.userId])).ok).toBe(true);
  expect((await classes.setTeachers(admin, codingId, [teacher.userId])).ok).toBe(true);
  expect((await classes.setTeachers(admin, paintingId, [otherTeacher.userId])).ok).toBe(true);

  return {
    classes,
    teacher,
    otherTeacher,
    staff,
    roboticsId,
    codingId,
    paintingId,
    julyId: july.value.id,
    augustId: august.value.id,
  };
}

describe('listMyClasses', () => {
  it('lists the teacher own classes grouped by session, in start order', async () => {
    const { classes, teacher, julyId, augustId } = await build();
    const mine = await classes.listMyClasses(teacher);
    if (!mine.ok) {
      throw new Error('expected a list');
    }
    expect(mine.value.map(s => s.id)).toEqual([julyId, augustId]);
    const july = mine.value.find(s => s.id === julyId);
    const august = mine.value.find(s => s.id === augustId);
    expect(july?.classes.map(c => c.name)).toEqual(['Robotics']);
    expect(august?.classes.map(c => c.name)).toEqual(['Coding']);
    expect(july?.startsOn).toBe(JULY_SESSION.startsOn);
  });

  it('does not list another teacher class, and the other teacher sees only its own', async () => {
    const { classes, teacher, otherTeacher } = await build();
    const mine = await classes.listMyClasses(teacher);
    const theirs = await classes.listMyClasses(otherTeacher);
    if (!mine.ok || !theirs.ok) {
      throw new Error('expected lists');
    }
    const names = (sessions: typeof mine.value) => sessions.flatMap(s => s.classes.map(c => c.name));
    expect(names(mine.value)).not.toContain('Painting');
    expect(names(theirs.value)).toEqual(['Painting']);
  });

  it('returns only the scheduling fields: no seats, campers or instructors', async () => {
    const { classes, teacher } = await build();
    const mine = await classes.listMyClasses(teacher);
    if (!mine.ok) {
      throw new Error('expected a list');
    }
    for (const session of mine.value) {
      for (const cls of session.classes) {
        expect(Object.keys(cls).sort()).toEqual(['ageRange', 'endsAt', 'id', 'location', 'name', 'startsAt']);
      }
    }
  });

  it('gives a non-teacher an empty list', async () => {
    const { classes, staff } = await build();
    expect(await classes.listMyClasses(staff)).toEqual({ ok: true, value: [] });
  });

  it('gives an empty list to a teacher with no assignments', async () => {
    const bare = await createCamp('UTC', '2027-07-10T09:00:00Z');
    const store = bare.repos.classes as InMemoryClassRepository;
    store.seedTeacher(bare.orgId, 'lonely');
    const service = createClassService({ repo: bare.repos.classes, timezoneOf: () => Promise.resolve('UTC') });
    expect(await service.listMyClasses({ userId: 'lonely', orgId: bare.orgId, role: 'teacher' })).toEqual({
      ok: true,
      value: [],
    });
  });
});

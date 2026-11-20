import { describe, expect, it } from 'vitest';
import { createClassService } from '../../classes/ClassService';
import { painting, robotics, JULY_SESSION } from '../../classes/__tests__/fixtures';
import { createCamp, thrown } from './support';

// The session page lists which teachers each class has. Only classes:manage (staff and admins) may read it; a teacher or a viewer
// is refused, and the list reflects the last save.

const ROBOTICS_TIMES = { startsAt: '2027-07-10T09:00:00Z', endsAt: '2027-07-10T12:00:00Z' };
const PAINTING_TIMES = { startsAt: '2027-07-10T13:00:00Z', endsAt: '2027-07-10T15:00:00Z' };

async function build() {
  const camp = await createCamp('UTC', '2027-07-10T09:00:00Z');
  const admin = camp.actor('admin');
  const teacher = camp.actor('teacher');
  const classes = createClassService({ repo: camp.repos.classes, timezoneOf: () => Promise.resolve('UTC') });
  const session = await classes.createSession(admin, JULY_SESSION);
  if (!session.ok) {
    throw new Error('session');
  }
  const first = await classes.addClass(admin, session.value.id, { ...robotics, ...ROBOTICS_TIMES });
  const second = await classes.addClass(admin, session.value.id, { ...painting, ...PAINTING_TIMES });
  if (!first.ok || !second.ok) {
    throw new Error('classes');
  }

  return {
    classes,
    admin,
    teacher,
    viewer: camp.actor('viewer'),
    sessionId: session.value.id,
    first: first.value.id,
    second: second.value.id,
  };
}

describe('teacher assignments on the session page', () => {
  it('lists each class with the teachers saved for it', async () => {
    const { classes, admin, teacher, sessionId, first, second } = await build();
    expect((await classes.setTeachers(admin, first, [teacher.userId])).ok).toBe(true);

    const listed = await classes.listTeacherAssignments(admin, sessionId);

    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toEqual([{ classId: first, userId: teacher.userId }]);
      expect(listed.value.some(a => a.classId === second)).toBe(false);
    }
  });

  it('shows nothing once the teachers are cleared', async () => {
    const { classes, admin, teacher, sessionId, first } = await build();
    await classes.setTeachers(admin, first, [teacher.userId]);
    await classes.setTeachers(admin, first, []);

    const listed = await classes.listTeacherAssignments(admin, sessionId);

    expect(listed.ok && listed.value).toEqual([]);
  });

  it('refuses a teacher and a viewer, who may not manage class teachers', async () => {
    const { classes, teacher, viewer, sessionId } = await build();

    expect((await thrown(() => classes.listTeacherAssignments(teacher, sessionId))).statusCode).toBe(403);
    expect((await thrown(() => classes.listTeacherAssignments(viewer, sessionId))).statusCode).toBe(403);
  });
});

import { describe, expect, it } from 'vitest';
import { createClassService } from '../../classes/ClassService';
import { painting, robotics, JULY_SESSION } from '../../classes/__tests__/fixtures';
import { createCamp, thrown } from './support';

// A teacher may change only the name (and description, once a class has one) of a class it is assigned to. Anything else needs
// classes:manage; the service refuses such a change with teacher_field_refused, and never writes it.

const TIMES = { startsAt: '2027-07-10T09:00:00Z', endsAt: '2027-07-10T12:00:00Z' };

async function build() {
  const camp = await createCamp('UTC', '2027-07-10T09:00:00Z');
  const admin = camp.actor('admin');
  const teacher = camp.actor('teacher');
  const classes = createClassService({ repo: camp.repos.classes, timezoneOf: () => Promise.resolve('UTC') });
  const session = await classes.createSession(admin, JULY_SESSION);
  if (!session.ok) {
    throw new Error('session');
  }
  const added = await classes.addClass(admin, session.value.id, { ...robotics, ...TIMES });
  if (!added.ok) {
    throw new Error(added.failure.message);
  }
  const other = await classes.addClass(admin, session.value.id, {
    ...painting,
    startsAt: '2027-07-10T13:00:00Z',
    endsAt: '2027-07-10T15:00:00Z',
  });
  if (!other.ok) {
    throw new Error(other.failure.message);
  }
  expect((await classes.setTeachers(admin, added.value.id, [teacher.userId])).ok).toBe(true);

  return { classes, admin, teacher, staff: camp.actor('staff'), classId: added.value.id, otherId: other.value.id };
}

const saved = {
  name: robotics.name,
  ageRange: robotics.ageRange,
  capacity: robotics.capacity,
  location: robotics.location,
  instructorIds: [],
  price: null,
  ...TIMES,
};

describe('a teacher edits its own class: the name only', () => {
  it('may rename a class it is assigned to', async () => {
    const { classes, teacher, classId } = await build();
    const out = await classes.updateClass(teacher, classId, { ...saved, name: 'Robotics Lab' });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.name).toBe('Robotics Lab');
    }
  });

  it('is refused a change to the location, and the class keeps its location', async () => {
    const { classes, teacher, classId } = await build();
    const out = await classes.updateClass(teacher, classId, { ...saved, location: 'Gym' });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.failure.reason).toBe('teacher_field_refused');
      expect(out.failure.message).toContain('location');
    }
    const now = await classes.getClass(teacher, classId);
    expect(now.ok && now.value.location).toBe(robotics.location);
  });

  it('is refused a change to the camp size, the ages, the times or the instructors', async () => {
    const { classes, teacher, classId } = await build();
    for (const change of [
      { capacity: 9 },
      { ageRange: { minAge: 7, maxAge: 13 } },
      { endsAt: '2027-07-10T13:00:00Z' },
      { instructorIds: ['00000000-0000-4000-8000-000000000001'] },
      { price: { currency: 'USD', regularMinor: 1000, earlyBirdMinor: null, earlyBirdUntil: null } },
    ]) {
      const out = await classes.updateClass(teacher, classId, { ...saved, ...change });
      expect(out.ok, JSON.stringify(change)).toBe(false);
      if (!out.ok) {
        expect(out.failure.reason).toBe('teacher_field_refused');
      }
    }
  });

  it('is refused a class it is not assigned to, before anything is read', async () => {
    const { classes, teacher, otherId } = await build();
    const error = await thrown(() =>
      classes.updateClass(teacher, otherId, {
        ...saved,
        name: 'Painting',
        startsAt: '2027-07-10T13:00:00Z',
        endsAt: '2027-07-10T15:00:00Z',
      }),
    );
    expect(error.statusCode).toBe(403);
  });
});

describe('staff and admin keep every field', () => {
  it('an admin may change the location', async () => {
    const { classes, admin, classId } = await build();
    const out = await classes.updateClass(admin, classId, { ...saved, location: 'Gym' });
    expect(out.ok).toBe(true);
  });

  it('staff may change the camp size', async () => {
    const { classes, staff, classId } = await build();
    const out = await classes.updateClass(staff, classId, { ...saved, capacity: 9 });
    expect(out.ok).toBe(true);
  });
});

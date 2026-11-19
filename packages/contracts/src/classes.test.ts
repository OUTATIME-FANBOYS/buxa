import { describe, expect, it } from 'vitest';
import {
  CampSizeSchema,
  ClassInputSchema,
  ClassInstructorSchema,
  MAX_CLASS_INSTRUCTORS,
  NewSessionInputSchema,
} from './classes';

const ID = '88888888-8888-4888-8888-888888888888';
const times = { startsAt: '2027-07-05T09:00:00+10:00', endsAt: '2027-07-05T12:00:00+10:00' };
const classFields = {
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 12,
  location: 'Lab 1',
  instructorIds: [] as string[],
};
const session = { name: 'Summer camp', description: '', startsOn: '2027-07-01', endsOn: '2027-07-31' };

describe('class instructor names', () => {
  it('trims the name', () => {
    expect(ClassInstructorSchema.parse({ id: ID, name: '  Ana Ruiz  ' })).toEqual({ id: ID, name: 'Ana Ruiz' });
  });

  it('refuses an empty name, or one that is only spaces', () => {
    expect(ClassInstructorSchema.safeParse({ id: ID, name: '' }).success).toBe(false);
    expect(ClassInstructorSchema.safeParse({ id: ID, name: '   ' }).success).toBe(false);
  });

  it('refuses a name longer than 120 characters, and accepts exactly 120', () => {
    expect(ClassInstructorSchema.safeParse({ id: ID, name: 'a'.repeat(120) }).success).toBe(true);
    expect(ClassInstructorSchema.safeParse({ id: ID, name: 'a'.repeat(121) }).success).toBe(false);
  });
});

describe('class instructor count', () => {
  it('allows up to the maximum on input, and refuses one more', () => {
    const ids = (n: number) =>
      Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    expect(
      ClassInputSchema.safeParse({ ...classFields, ...times, instructorIds: ids(MAX_CLASS_INSTRUCTORS) }).success,
    ).toBe(true);
    expect(
      ClassInputSchema.safeParse({ ...classFields, ...times, instructorIds: ids(MAX_CLASS_INSTRUCTORS + 1) }).success,
    ).toBe(false);
  });
});

describe('camp size (the places in a class): a whole number from 3 to 30', () => {
  it.each([3, 15, 30])('accepts %i', n => {
    expect(CampSizeSchema.safeParse(n).success).toBe(true);
  });

  it.each([2, 31, 3.5, 0, -4, Number.NaN])('refuses %s, with the message the form shows', n => {
    const result = CampSizeSchema.safeParse(n);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Camp Size must be a whole number from 3 to 30.');
    }
  });

  it('is enforced on a class input, so the server does not trust the browser', () => {
    expect(ClassInputSchema.safeParse({ ...classFields, ...times, capacity: 31 }).success).toBe(false);
    expect(ClassInputSchema.safeParse({ ...classFields, ...times, capacity: 2 }).success).toBe(false);
    expect(ClassInputSchema.safeParse({ ...classFields, ...times, capacity: 3 }).success).toBe(true);
  });
});

describe('class time range', () => {
  it('refuses a class that ends before it starts, on the end field', () => {
    const r = ClassInputSchema.safeParse({ ...classFields, startsAt: times.endsAt, endsAt: times.startsAt });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['endsAt']);
    }
  });
});

describe('session date range (the parent)', () => {
  it('accepts a session on one day, and refuses one that ends before its first day', () => {
    expect(NewSessionInputSchema.safeParse({ ...session, endsOn: session.startsOn }).success).toBe(true);
    expect(NewSessionInputSchema.safeParse({ ...session, startsOn: '2027-07-10', endsOn: '2027-07-09' }).success).toBe(
      false,
    );
  });

  it('refuses a date that is not a calendar day', () => {
    expect(NewSessionInputSchema.safeParse({ ...session, startsOn: '2027-7-1' }).success).toBe(false);
  });
});

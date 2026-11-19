import { describe, expect, it } from 'vitest';
import { checkAge, instructorRatio, isValidAgeRange, seatFor, seatsLeft } from '../src';

describe('age range (inclusive)', () => {
  const range = { minAge: 8, maxAge: 12 };

  it('accepts the minimum and maximum ages', () => {
    // Born 2019-07-05: on 2027-07-05 that is exactly 8. Born 2015-07-05: on 2027-07-05 that is exactly 12.
    expect(checkAge('2019-07-05', '2027-07-05', range)).toEqual({ ok: true, age: 8 });
    expect(checkAge('2015-07-05', '2027-07-05', range)).toEqual({ ok: true, age: 12 });
  });

  it('refuses one day under the minimum, with the age it found', () => {
    expect(checkAge('2019-07-06', '2027-07-05', range)).toEqual({ ok: false, age: 7, range });
  });

  it('refuses one day over the maximum', () => {
    expect(checkAge('2014-07-04', '2027-07-05', range)).toEqual({ ok: false, age: 13, range });
  });

  it('counts the age on the session day, not today', () => {
    expect(checkAge('2014-07-05', '2027-07-05', range).ok).toBe(false);
    expect(checkAge('2014-07-05', '2027-07-04', range).ok).toBe(true);
  });

  it('a leap-day birthday completes a year on 28 February in a non-leap year', () => {
    expect(checkAge('2016-02-29', '2027-02-28', { minAge: 10, maxAge: 10 })).toEqual({ ok: true, age: 10 });
    expect(checkAge('2016-02-29', '2027-02-27', { minAge: 10, maxAge: 10 })).toEqual({ ok: true, age: 10 });
  });

  it('validates the range: whole numbers, min not above max, no negatives', () => {
    expect(isValidAgeRange({ minAge: 8, maxAge: 12 })).toBe(true);
    expect(isValidAgeRange({ minAge: 8, maxAge: 8 })).toBe(true);
    expect(isValidAgeRange({ minAge: 12, maxAge: 8 })).toBe(false);
    expect(isValidAgeRange({ minAge: -1, maxAge: 8 })).toBe(false);
    expect(isValidAgeRange({ minAge: 8.5, maxAge: 12 })).toBe(false);
  });
});

describe('capacity (hard limit)', () => {
  it('has a seat while taken is below capacity', () => {
    expect(seatFor(10, 9)).toEqual({ kind: 'seat' });
  });
  it('is full when taken reaches capacity', () => {
    expect(seatFor(10, 10)).toEqual({ kind: 'full', capacity: 10 });
  });
  it('seats left never goes negative', () => {
    expect(seatsLeft(10, 4)).toBe(6);
    expect(seatsLeft(10, 10)).toBe(0);
    expect(seatsLeft(10, 12)).toBe(0);
  });
});

describe('instructor ratio (computed and reported, not enforced)', () => {
  it('is null when no ratio is set', () => {
    expect(instructorRatio(null, 20, 1)).toBeNull();
  });

  it('reports no shortfall when there are enough instructors for the campers', () => {
    expect(instructorRatio({ instructors: 1, campers: 8 }, 8, 1)).toEqual({
      ratio: { instructors: 1, campers: 8 },
      enrolled: 8,
      assignedInstructors: 1,
      requiredInstructors: 1,
      shortfall: 0,
      withinRatio: true,
      campersPerInstructor: 8,
    });
  });

  it('rounds the required instructors up and reports the shortfall', () => {
    const r = instructorRatio({ instructors: 1, campers: 8 }, 9, 1);
    expect(r?.requiredInstructors).toBe(2);
    expect(r?.shortfall).toBe(1);
    expect(r?.withinRatio).toBe(false);
  });

  it('is within ratio with no campers, and has no campers per instructor when nobody is assigned', () => {
    expect(instructorRatio({ instructors: 1, campers: 8 }, 0, 0)).toMatchObject({
      requiredInstructors: 0,
      shortfall: 0,
      withinRatio: true,
      campersPerInstructor: null,
    });
    expect(instructorRatio({ instructors: 1, campers: 8 }, 3, 0)).toMatchObject({
      requiredInstructors: 1,
      shortfall: 1,
      campersPerInstructor: null,
    });
  });

  it('does not refuse anything: the report is the only output', () => {
    expect(() => instructorRatio({ instructors: 1, campers: 1 }, 50, 0)).not.toThrow();
  });
});

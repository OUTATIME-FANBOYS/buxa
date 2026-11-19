import { describe, expect, it } from 'vitest';
import { MAX_AGE_LIMIT } from '@buxa/domain';
import {
  toActiveFacts,
  toAgeRange,
  toClass,
  toEnrolment,
  toSession,
  type ClassRow,
  type EnrolmentRow,
  type SessionRow,
} from './PgClassQueries';

const created = new Date('2027-07-01T00:00:00.000Z');

const classRow = (over: Partial<ClassRow> = {}): ClassRow => ({
  id: 'c1',
  name: 'Robotics',
  description: null,
  age_min: 8,
  age_max: 12,
  default_capacity: 10,
  ratio_campers: null,
  ratio_instructors: null,
  created_at: created,
  ...over,
});

describe('toAgeRange', () => {
  it('fills an open end with the contract bounds', () => {
    expect(toAgeRange(null, null)).toEqual({ minAge: 0, maxAge: MAX_AGE_LIMIT });
    expect(toAgeRange(null, 12)).toEqual({ minAge: 0, maxAge: 12 });
    expect(toAgeRange(8, null)).toEqual({ minAge: 8, maxAge: MAX_AGE_LIMIT });
  });

  it('keeps stored bounds as they are, including the inclusive ends', () => {
    expect(toAgeRange(8, 12)).toEqual({ minAge: 8, maxAge: 12 });
  });
});

describe('toClass', () => {
  it('maps a row to the contract, with an ISO instant and an empty description for NULL', () => {
    expect(toClass(classRow())).toEqual({
      id: 'c1',
      name: 'Robotics',
      description: '',
      ageRange: { minAge: 8, maxAge: 12 },
      capacity: 10,
      instructorRatio: null,
      createdAt: '2027-07-01T00:00:00.000Z',
    });
  });

  it('builds the ratio only when both numbers are stored', () => {
    expect(toClass(classRow({ ratio_campers: 8, ratio_instructors: 1 })).instructorRatio).toEqual({
      instructors: 1,
      campers: 8,
    });
    expect(toClass(classRow({ ratio_campers: 8, ratio_instructors: null })).instructorRatio).toBeNull();
  });
});

describe('toSession', () => {
  const row: SessionRow = {
    id: 's1',
    class_id: 'c1',
    class_name: 'Robotics',
    starts_at: new Date('2027-07-04T23:00:00.000Z'),
    ends_at: new Date('2027-07-05T02:00:00.000Z'),
    location: 'Lab 1',
    capacity: 5,
    seats_taken: 2,
    waitlisted: 1,
    instructors: [
      { id: 'p1', name: 'Ada Test' },
      { id: 'p2', name: 'Ben Test' },
    ],
  };

  it('maps instants to ISO strings, with the instructors and their names', () => {
    const mapped = toSession(row);
    expect(mapped).toEqual({
      id: 's1',
      classId: 'c1',
      className: 'Robotics',
      startsAt: '2027-07-04T23:00:00.000Z',
      endsAt: '2027-07-05T02:00:00.000Z',
      location: 'Lab 1',
      instructorIds: ['p1', 'p2'],
      instructors: [
        { id: 'p1', name: 'Ada Test' },
        { id: 'p2', name: 'Ben Test' },
      ],
      capacity: 5,
      seatsTaken: 2,
      waitlisted: 1,
    });
    expect(mapped.instructors).not.toBe(row.instructors);
  });

  it('a session with no instructors maps to empty lists', () => {
    expect(toSession({ ...row, instructors: [] })).toMatchObject({ instructorIds: [], instructors: [] });
  });
});

describe('toEnrolment', () => {
  it('maps the row, with the override reason only when there is one', () => {
    const row: EnrolmentRow = {
      id: 'e1',
      session_id: 's1',
      class_id: 'c1',
      class_name: 'Robotics',
      camper_id: 'p1',
      camper_name: 'Ada Test',
      status: 'enrolled',
      created_at: created,
      override_reason: null,
    };
    expect(toEnrolment(row)).toEqual({
      id: 'e1',
      sessionId: 's1',
      classId: 'c1',
      className: 'Robotics',
      camperId: 'p1',
      camperName: 'Ada Test',
      status: 'enrolled',
      enrolledAt: '2027-07-01T00:00:00.000Z',
      overrideReason: null,
    });
    expect(toEnrolment({ ...row, override_reason: 'Swap' }).overrideReason).toBe('Swap');
  });
});

describe('toActiveFacts', () => {
  it('gives the overlap rule ISO instants for both ends', () => {
    expect(
      toActiveFacts({
        session_id: 's9',
        class_name: 'Painting',
        starts_at: new Date('2027-07-05T01:00:00.000Z'),
        ends_at: new Date('2027-07-05T03:00:00.000Z'),
      }),
    ).toEqual({
      sessionId: 's9',
      className: 'Painting',
      startsAt: '2027-07-05T01:00:00.000Z',
      endsAt: '2027-07-05T03:00:00.000Z',
    });
  });
});

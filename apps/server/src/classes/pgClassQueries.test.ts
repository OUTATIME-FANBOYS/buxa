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

const sessionRow = (over: Partial<SessionRow> = {}): SessionRow => ({
  id: 'p1',
  name: 'Summer camp',
  description: null,
  starts_on: '2027-07-01',
  ends_on: '2027-07-31',
  class_count: 2,
  is_public: false,
  status: 'live',
  archived_at: null,
  created_at: created,
  ...over,
});

const classRow = (over: Partial<ClassRow> = {}): ClassRow => ({
  id: 'c1',
  dates_outside_session: false,
  session_id: 'p1',
  session_name: 'Summer camp',
  name: 'Robotics',
  age_min: 8,
  age_max: 12,
  capacity: 5,
  starts_at: new Date('2027-07-04T23:00:00.000Z'),
  ends_at: new Date('2027-07-05T02:00:00.000Z'),
  location: 'Lab 1',
  seats_taken: 2,
  waitlisted: 1,
  instructors: [
    { id: 'i1', name: 'Ada Test' },
    { id: 'i2', name: 'Ben Test' },
  ],
  price_minor: null,
  price_currency: null,
  early_bird_minor: null,
  early_bird_until: null,
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

describe('toSession', () => {
  it('maps a session row, with its dates as written and an empty description for NULL', () => {
    expect(toSession(sessionRow())).toEqual({
      id: 'p1',
      name: 'Summer camp',
      description: '',
      startsOn: '2027-07-01',
      endsOn: '2027-07-31',
      classCount: 2,
      isPublic: false,
      status: 'live',
      archivedAt: null,
      createdAt: '2027-07-01T00:00:00.000Z',
    });
  });

  it('carries the archive time when the session is archived, and null while it is live', () => {
    expect(toSession(sessionRow({ archived_at: new Date('2027-06-01T02:00:00Z') }))).toMatchObject({
      archivedAt: '2027-06-01T02:00:00.000Z',
    });
  });

  it('keeps NULL dates as NULL, for a session with no class yet', () => {
    expect(toSession(sessionRow({ starts_on: null, ends_on: null }))).toMatchObject({ startsOn: null, endsOn: null });
  });
});

describe('toClass', () => {
  it('maps a class row, with its own ages and camp size, ISO instants and the instructors by name', () => {
    const mapped = toClass(classRow());
    expect(mapped).toEqual({
      id: 'c1',
      sessionId: 'p1',
      sessionName: 'Summer camp',
      name: 'Robotics',
      ageRange: { minAge: 8, maxAge: 12 },
      capacity: 5,
      startsAt: '2027-07-04T23:00:00.000Z',
      endsAt: '2027-07-05T02:00:00.000Z',
      location: 'Lab 1',
      instructorIds: ['i1', 'i2'],
      price: null,
      instructors: [
        { id: 'i1', name: 'Ada Test' },
        { id: 'i2', name: 'Ben Test' },
      ],
      seatsTaken: 2,
      waitlisted: 1,
      datesOutsideSession: false,
    });
    expect(mapped.instructors).not.toBe(classRow().instructors);
  });

  it('a class with no instructors maps to empty lists', () => {
    expect(toClass(classRow({ instructors: [] }))).toMatchObject({ instructorIds: [], instructors: [] });
  });
});

describe('toEnrolment', () => {
  it('maps the row, with the override reason only when there is one', () => {
    const row: EnrolmentRow = {
      id: 'e1',
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
        class_id: 'c9',
        class_name: 'Painting',
        starts_at: new Date('2027-07-05T01:00:00.000Z'),
        ends_at: new Date('2027-07-05T03:00:00.000Z'),
      }),
    ).toEqual({
      sessionId: 'c9',
      className: 'Painting',
      startsAt: '2027-07-05T01:00:00.000Z',
      endsAt: '2027-07-05T03:00:00.000Z',
    });
  });
});

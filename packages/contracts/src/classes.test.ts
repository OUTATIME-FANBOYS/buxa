import { describe, expect, it } from 'vitest';
import { MAX_SESSION_INSTRUCTORS, NewSessionInputSchema, SessionInstructorSchema, SessionSchema } from './classes';

const ID = '88888888-8888-4888-8888-888888888888';
const session = { startsAt: '2027-07-05T09:00:00+10:00', endsAt: '2027-07-05T12:00:00+10:00', location: 'Lab 1' };

describe('session instructor names', () => {
  it('trims the name', () => {
    expect(SessionInstructorSchema.parse({ id: ID, name: '  Ana Ruiz  ' })).toEqual({ id: ID, name: 'Ana Ruiz' });
  });

  it('refuses an empty name, or one that is only spaces', () => {
    expect(SessionInstructorSchema.safeParse({ id: ID, name: '' }).success).toBe(false);
    expect(SessionInstructorSchema.safeParse({ id: ID, name: '   ' }).success).toBe(false);
  });

  it('refuses a name longer than 120 characters, and accepts exactly 120', () => {
    expect(SessionInstructorSchema.safeParse({ id: ID, name: 'a'.repeat(120) }).success).toBe(true);
    expect(SessionInstructorSchema.safeParse({ id: ID, name: 'a'.repeat(121) }).success).toBe(false);
  });
});

describe('session instructor count', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: ID, name: `Person ${i}` }));

  it('allows up to the maximum on a session read, and refuses one more', () => {
    const base = { id: 's1', classId: 'c1', className: 'Robotics', instructorIds: [], capacity: 8, seatsTaken: 0, waitlisted: 0, ...session };
    expect(SessionSchema.safeParse({ ...base, instructors: many(MAX_SESSION_INSTRUCTORS) }).success).toBe(true);
    expect(SessionSchema.safeParse({ ...base, instructors: many(MAX_SESSION_INSTRUCTORS + 1) }).success).toBe(false);
  });

  it('allows up to the maximum on input, and refuses one more', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    expect(NewSessionInputSchema.safeParse({ ...session, instructorIds: ids(MAX_SESSION_INSTRUCTORS) }).success).toBe(true);
    expect(NewSessionInputSchema.safeParse({ ...session, instructorIds: ids(MAX_SESSION_INSTRUCTORS + 1) }).success).toBe(false);
  });
});

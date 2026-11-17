import { describe, expect, it } from 'vitest';
import { findClash, isValidSpan, overlaps, type Span } from '../src';

const span = (startsAt: string, endsAt: string): Span => ({ startsAt, endsAt });

describe('overlaps (sessions and enrolments)', () => {
  const morning = span('2027-07-05T09:00:00+10:00', '2027-07-05T12:00:00+10:00');

  it('sessions that touch do not overlap (end is exclusive)', () => {
    expect(overlaps(morning, span('2027-07-05T12:00:00+10:00', '2027-07-05T13:00:00+10:00'))).toBe(false);
    expect(overlaps(morning, span('2027-07-05T08:00:00+10:00', '2027-07-05T09:00:00+10:00'))).toBe(false);
  });

  it('a session that overlaps by one minute clashes', () => {
    expect(overlaps(morning, span('2027-07-05T11:59:00+10:00', '2027-07-05T13:00:00+10:00'))).toBe(true);
  });

  it('a session nested inside another clashes, in either order', () => {
    const inner = span('2027-07-05T10:00:00+10:00', '2027-07-05T11:00:00+10:00');
    expect(overlaps(morning, inner)).toBe(true);
    expect(overlaps(inner, morning)).toBe(true);
  });

  it('a session that contains another clashes', () => {
    expect(overlaps(span('2027-07-05T08:00:00+10:00', '2027-07-05T18:00:00+10:00'), morning)).toBe(true);
  });

  it('identical sessions clash', () => {
    expect(overlaps(morning, { ...morning })).toBe(true);
  });

  it('a session that crosses midnight clashes with the early hours of the next day', () => {
    const lateNight = span('2027-07-05T22:00:00+10:00', '2027-07-06T02:00:00+10:00');
    expect(overlaps(lateNight, span('2027-07-06T01:00:00+10:00', '2027-07-06T03:00:00+10:00'))).toBe(true);
    expect(overlaps(lateNight, span('2027-07-06T02:00:00+10:00', '2027-07-06T03:00:00+10:00'))).toBe(false);
  });

  it('the same clock times on different days do not clash', () => {
    expect(overlaps(morning, span('2027-07-06T09:00:00+10:00', '2027-07-06T12:00:00+10:00'))).toBe(false);
  });

  it('compares instants, so the same moment in two offsets clashes', () => {
    expect(overlaps(morning, span('2027-07-04T23:30:00Z', '2027-07-05T00:30:00Z'))).toBe(true);
  });
});

describe('findClash', () => {
  const candidate = span('2027-07-05T09:00:00Z', '2027-07-05T12:00:00Z');
  const painting = { name: 'Painting', ...span('2027-07-05T11:00:00Z', '2027-07-05T13:00:00Z') };
  const robotics = { name: 'Robotics', ...span('2027-07-05T08:00:00Z', '2027-07-05T10:00:00Z') };
  const later = { name: 'Swimming', ...span('2027-07-05T12:00:00Z', '2027-07-05T14:00:00Z') };

  it('returns null when nothing clashes', () => {
    expect(findClash(candidate, [later])).toBeNull();
    expect(findClash(candidate, [])).toBeNull();
  });

  it('returns the clashing item, naming it', () => {
    expect(findClash(candidate, [later, painting])?.name).toBe('Painting');
  });

  it('is deterministic when several clash: the earliest start wins', () => {
    expect(findClash(candidate, [painting, robotics])?.name).toBe('Robotics');
    expect(findClash(candidate, [robotics, painting])?.name).toBe('Robotics');
  });
});

describe('isValidSpan', () => {
  it('needs an end after the start', () => {
    expect(isValidSpan(span('2027-07-05T09:00:00Z', '2027-07-05T10:00:00Z'))).toBe(true);
    expect(isValidSpan(span('2027-07-05T10:00:00Z', '2027-07-05T10:00:00Z'))).toBe(false);
    expect(isValidSpan(span('2027-07-05T10:00:00Z', '2027-07-05T09:00:00Z'))).toBe(false);
  });
  it('rejects text that is not a time', () => {
    expect(isValidSpan(span('tomorrow', '2027-07-05T10:00:00Z'))).toBe(false);
  });
});

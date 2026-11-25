import { describe, expect, it } from 'vitest';
import { teachesVisit, teachingDays, teachingScopeOf, type TeachingDay } from './teaching';

const day = (
  id: string,
  sessionId: string,
  seriesId: string,
  occurrenceStatus: TeachingDay['occurrenceStatus'] = 'active',
): TeachingDay => ({ id, sessionId, seriesId, occurrenceStatus });

describe('teachingDays (the My classes rule)', () => {
  it('keeps only active days: a cancelled day is not on a teacher plan', () => {
    const days = [day('d1', 'S1', 'R'), day('d2', 'S1', 'R', 'cancelled')];
    expect(teachingDays(days).map(d => d.id)).toEqual(['d1']);
  });
});

describe('teachingScopeOf', () => {
  it('holds the sessions and series of the active days the teacher teaches', () => {
    const scope = teachingScopeOf([day('d1', 'S1', 'R'), day('d2', 'S1', 'R'), day('d3', 'S2', 'C')]);
    expect([...scope.sessionIds].sort()).toEqual(['S1', 'S2']);
    expect([...scope.seriesIds].sort()).toEqual(['C', 'R']);
  });

  it('leaves out a session whose only days are cancelled', () => {
    const scope = teachingScopeOf([day('d1', 'S1', 'R'), day('d2', 'S2', 'C', 'cancelled')]);
    expect([...scope.sessionIds]).toEqual(['S1']);
    expect([...scope.seriesIds]).toEqual(['R']);
  });

  it('is empty for a teacher with no classes', () => {
    const scope = teachingScopeOf([]);
    expect(scope.sessionIds.size).toBe(0);
    expect(scope.seriesIds.size).toBe(0);
  });
});

describe('teachesVisit', () => {
  const scope = teachingScopeOf([day('d1', 'S1', 'R')]);

  it('accepts a visit to a class the teacher teaches', () => {
    expect(teachesVisit(scope, { sessionId: 'S1', classId: 'R' })).toBe(true);
  });

  it('refuses a visit to another series of a session the teacher teaches in', () => {
    expect(teachesVisit(scope, { sessionId: 'S1', classId: 'P' })).toBe(false);
  });

  it('refuses a visit to a session the teacher does not teach in', () => {
    expect(teachesVisit(scope, { sessionId: 'S2', classId: 'R' })).toBe(false);
  });

  it('refuses a camp-day visit with no session', () => {
    expect(teachesVisit(scope, { sessionId: null, classId: null })).toBe(false);
  });

  it('judges a session visit with no known class by its session', () => {
    expect(teachesVisit(scope, { sessionId: 'S1', classId: null })).toBe(true);
  });
});

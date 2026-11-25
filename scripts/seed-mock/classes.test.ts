import { describe, expect, it } from 'vitest';
import {
  CLASS_PLAN,
  SESSION_PLAN,
  TEACHER_PLAN,
  isFictionalEmail,
  pickDeveloperOwner,
  plannedCampersAreInRoster,
} from './classes';

describe('the class plan', () => {
  it('has two sessions, one public, and three classes across them', () => {
    expect(SESSION_PLAN.map(s => s.name)).toEqual(['Summer 2027', 'Art Session']);
    expect(SESSION_PLAN.filter(s => s.isPublic)).toHaveLength(1);
    expect(CLASS_PLAN).toHaveLength(3);
  });

  it('keeps every class inside its session dates (UTC is the camp timezone)', () => {
    for (const cls of CLASS_PLAN) {
      const session = SESSION_PLAN.find(s => s.name === cls.session);
      const day = cls.startsAt.slice(0, 10);
      expect(session !== undefined && day >= session.startsOn && day <= session.endsOn).toBe(true);
      expect(cls.endsAt > cls.startsAt).toBe(true);
    }
  });

  it('gives every name a unique key, so a second run finds the same rows', () => {
    const sessionNames = SESSION_PLAN.map(s => s.name);
    const classNames = CLASS_PLAN.map(c => c.name);
    expect(new Set(sessionNames).size).toBe(sessionNames.length);
    expect(new Set(classNames).size).toBe(classNames.length);
  });

  it('enrols campers that exist in the roster, and has one class past its capacity for a waitlist', () => {
    expect(plannedCampersAreInRoster()).toBe(true);
    const small = CLASS_PLAN.find(c => c.name === 'Swim Stars');
    expect(small !== undefined && small.campers.length > small.capacity).toBe(true);
    for (const cls of CLASS_PLAN.filter(c => c !== small)) {
      expect(cls.campers.length).toBeLessThanOrEqual(cls.capacity);
    }
  });

  it('assigns the teacher to exactly one class, with the reserved fictional email', () => {
    expect(CLASS_PLAN.filter(c => c.hasTeacher).map(c => c.name)).toEqual(['Watercolour Basics']);
    expect(TEACHER_PLAN.email).toBe('teacher.demo@example.test');
    expect(isFictionalEmail(TEACHER_PLAN.email)).toBe(true);
  });
});

describe('the prices in the plan', () => {
  it('are on classes only: no session in the plan carries a price', () => {
    for (const session of SESSION_PLAN) {
      expect('price' in session).toBe(false);
    }
  });

  it('are valid class prices: a three-letter currency, and an early bird no higher than the regular price', () => {
    for (const cls of CLASS_PLAN) {
      if (cls.price === null) {
        continue;
      }
      expect(cls.price.currency).toMatch(/^[A-Z]{3}$/);
      expect(cls.price.regularMinor).toBeGreaterThanOrEqual(0);
      if (cls.price.earlyBirdMinor !== null) {
        expect(cls.price.earlyBirdMinor).toBeLessThanOrEqual(cls.price.regularMinor);
        expect(cls.price.earlyBirdUntil).not.toBeNull();
      }
    }
  });

  it('give at least one class a price and leave one without, so both states show', () => {
    expect(CLASS_PLAN.some(c => c.price !== null)).toBe(true);
    expect(CLASS_PLAN.some(c => c.price === null)).toBe(true);
  });
});

describe('pickDeveloperOwner', () => {
  it('picks the one real account, ignoring the fictional staff', () => {
    expect(pickDeveloperOwner(['adam.admin@example.com', 'teacher.demo@example.test', 'me@studio.dev'])).toEqual({
      kind: 'one',
      email: 'me@studio.dev',
    });
  });

  it('picks nobody when only fictional accounts exist', () => {
    expect(pickDeveloperOwner(['olive.owner@example.com'])).toEqual({ kind: 'none' });
  });

  it('does not guess between several real accounts', () => {
    expect(pickDeveloperOwner(['a@studio.dev', 'b@studio.dev'])).toEqual({ kind: 'many', count: 2 });
  });
});

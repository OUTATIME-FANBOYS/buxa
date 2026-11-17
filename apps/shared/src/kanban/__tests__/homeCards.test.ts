import { describe, expect, it } from 'vitest';
import type { CampHome, CheckInsByDay } from '../../camp/campHomeTypes';
import { dayChange, homeCards } from '../homeCards';

const series = (counts: number[], complete = true): CheckInsByDay => ({
  days: counts.map((count, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, count, minors: null })), complete,
});

const camp: CampHome = {
  campId: 'o1', name: 'Lake Camp', firstName: 'Priya', canRename: true,
  people: 40, onSite: 12, checkedInToday: 20, validMemberships: 30, upcomingSessions: [],
  checkInsByDay: series([5, 9, 20]), onSiteByAge: { adults: 10, minors: 2 },
  membershipStatus: { valid: 30, notStarted: 0, expired: 6, none: 4 },
};

describe('homeCards', () => {
  it('shows the three camp facts in one row, in order, with their values', () => {
    const cards = homeCards(camp);
    expect(cards.map(c => c.label)).toEqual(['On site now', 'Checked in today', 'Valid memberships']);
    expect(cards.map(c => c.value)).toEqual([12, 20, 30]);
  });

  it('says what each number counts, for the info icon', () => {
    const cards = homeCards(camp);
    expect(cards.every(c => c.info.length > 0)).toBe(true);
    expect(cards[0].info).toContain('not checked out');
  });

  it('gives every card a palette tone', () => {
    const tones = homeCards(camp).map(c => c.tone);
    expect(tones.every(t => ['neutral', 'brand', 'ok', 'warn', 'crit', 'agent', 'hero'].includes(t))).toBe(true);
  });

  it('leaves out a camp fact the viewer may not read', () => {
    const cards = homeCards({ ...camp, onSite: null, checkedInToday: null, checkInsByDay: null, validMemberships: null });
    expect(cards).toEqual([]);
    expect(homeCards({ ...camp, onSite: null }).map(c => c.label)).toEqual(['Checked in today', 'Valid memberships']);
  });

  it('gives the check-in card a change chip against yesterday', () => {
    const chip = homeCards(camp)[1].change;
    expect(chip).toEqual({ text: '+11 vs yesterday', tone: 'ok' });
  });

  it('gives the memberships card its share of the camp list', () => {
    expect(homeCards(camp)[2].change).toEqual({ text: '75% of people', tone: 'neutral' });
  });

  it('gives no membership share when the camp has no people', () => {
    expect(homeCards({ ...camp, people: 0 })[2].change).toBeNull();
  });
});

describe('dayChange', () => {
  it('reports a fall as a warn chip with its sign', () => {
    expect(dayChange(series([9, 4]))).toEqual({ text: '-5 vs yesterday', tone: 'warn' });
  });

  it('says so when the day matches yesterday', () => {
    expect(dayChange(series([3, 3]))).toEqual({ text: 'Same as yesterday', tone: 'neutral' });
  });

  it('gives no chip when the series is incomplete, or there is no series', () => {
    expect(dayChange(series([3, 4], false))).toBeNull();
    expect(dayChange(null)).toBeNull();
  });
});

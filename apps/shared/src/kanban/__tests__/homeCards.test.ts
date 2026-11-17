import { describe, expect, it } from 'vitest';
import type { CampHome } from '../../camp/campHomeTypes';
import { homeCards } from '../homeCards';

const camp: CampHome = {
  campId: 'o1', name: 'Lake Camp', firstName: 'Priya', canRename: true,
  people: 40, onSite: 12, checkedInToday: 20, validMemberships: 35, upcomingSessions: [],
};

describe('homeCards', () => {
  it('lists the camp facts in one row, in order', () => {
    const cards = homeCards(camp);
    expect(cards.map(c => c.label)).toEqual(['People', 'On site now', 'Checked in today', 'Valid memberships']);
    expect(cards.map(c => c.value)).toEqual([40, 12, 20, 35]);
  });

  it('gives every card a palette tone', () => {
    const tones = homeCards(camp).map(c => c.tone);
    expect(tones.every(t => ['neutral', 'brand', 'ok', 'warn', 'crit', 'agent', 'hero'].includes(t))).toBe(true);
  });

  it('leaves out a camp fact the viewer may not read', () => {
    const cards = homeCards({ ...camp, people: null, onSite: null, checkedInToday: null });
    expect(cards.map(c => c.label)).toEqual(['Valid memberships']);
  });
});

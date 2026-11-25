import { describe, expect, it } from 'vitest';
import { matchesPersonName } from '../searchPeople';

describe('matchesPersonName', () => {
  it('matches any part of the name, ignoring case', () => {
    expect(matchesPersonName('Ada Lovelace', 'LOVE')).toBe(true);
    expect(matchesPersonName('Ada Lovelace', 'ada')).toBe(true);
  });

  it('ignores accents on either side, so a name typed without them still finds it', () => {
    expect(matchesPersonName('José Álvarez', 'jose')).toBe(true);
    expect(matchesPersonName('Zoë Müller', 'muller')).toBe(true);
    expect(matchesPersonName('Renée Ødegaard', 'renee')).toBe(true);
  });

  it('treats a blank query as no filter', () => {
    expect(matchesPersonName('Ada Lovelace', '')).toBe(true);
    expect(matchesPersonName('Ada Lovelace', '   ')).toBe(true);
  });

  it('ignores the spaces around a query', () => {
    expect(matchesPersonName('Ada Lovelace', '  grace ')).toBe(false);
    expect(matchesPersonName('Ada Lovelace', '  ada ')).toBe(true);
  });

  it('does not match a name that does not contain the query', () => {
    expect(matchesPersonName('Ada Lovelace', 'grace')).toBe(false);
  });
});

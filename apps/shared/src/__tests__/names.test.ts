import { describe, expect, it } from 'vitest';
import { firstNameOf, fullNameOf } from '../names';
import { browserClockFormat } from '../clockPreference';

describe('firstNameOf', () => {
  it('is the first word of the full name', () => {
    expect(firstNameOf('Maya Chen')).toBe('Maya');
    expect(firstNameOf('Ana Maria Lopez')).toBe('Ana');
  });

  it('is the whole name when there is no last name, and tolerates spaces around it', () => {
    expect(firstNameOf('Mononym')).toBe('Mononym');
    expect(firstNameOf('   Maya   Chen  ')).toBe('Maya');
  });

  it('is empty for an empty name', () => {
    expect(firstNameOf('   ')).toBe('');
  });
});

describe('fullNameOf', () => {
  it('joins a first and last name with one space', () => {
    expect(fullNameOf('Maya', 'Chen')).toBe('Maya Chen');
  });

  it('is the first name alone when the last name is missing or blank', () => {
    expect(fullNameOf('Maya', null)).toBe('Maya');
    expect(fullNameOf('Maya', '  ')).toBe('Maya');
  });

  it('trims both parts', () => {
    expect(fullNameOf('  Maya ', ' Chen  ')).toBe('Maya Chen');
  });
});

describe('browserClockFormat', () => {
  it('answers 12h or 24h, the two clock formats the app keeps', () => {
    expect(['12h', '24h']).toContain(browserClockFormat());
  });
});

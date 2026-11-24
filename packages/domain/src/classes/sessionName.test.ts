import { describe, expect, it } from 'vitest';
import { nameKey, normaliseName } from './sessionName';

describe('name normalisation', () => {
  it.each([
    ['a non-breaking space', 'Summer 2027'],
    ['a zero-width space', 'Summer​2027'],
    ['a zero-width joiner', 'Summer‍2027'],
    ['an ideographic space', 'Summer　2027'],
    ['full-width letters', 'Ｓummer 2027'],
    ['runs of spaces and case', '  SUMMER    2027 '],
  ])('treats %s as the plain name', (_label, variant) => {
    expect(nameKey(variant)).toBe('summer 2027');
  });

  it('keeps the case of the stored name and turns space-like characters into one space', () => {
    expect(normaliseName(' Summer ​ 2027 ')).toBe('Summer 2027');
  });

  it('keeps different names different', () => {
    expect(nameKey('Summer 2027')).not.toBe(nameKey('Summer 2028'));
  });
});

import { describe, expect, it } from 'vitest';
import { avatarHue, KIND_TONE, PALETTE_HUES, tagHue } from '../tones';
import { progressValue } from '../../../elements/export';

describe('KIND_TONE', () => {
  it('maps every column kind to a tone', () => {
    expect(KIND_TONE).toEqual({ open: 'neutral', active: 'brand', done: 'ok' });
  });
});

describe('avatarHue', () => {
  it('is stable for a name and always one of the person hues', () => {
    expect(avatarHue('Maya Chen')).toBe(avatarHue('Maya Chen'));
    for (const n of ['A', 'Maya Chen', 'Jo', '', 'Zoë Ångström']) expect(PALETTE_HUES).toContain(avatarHue(n));
  });
  it('is the char-code sum modulo the five palette hues', () => {
    expect(avatarHue('A')).toBe('brand'); // 65 % 5 = 0
    expect(avatarHue('B')).toBe('ok'); // 66 % 5 = 1
    expect(avatarHue('')).toBe('brand'); // 0
  });
});

describe('tagHue', () => {
  it('is stable and case-insensitive, and always a palette hue', () => {
    expect(tagHue('Planning')).toBe(tagHue('planning'));
    expect(PALETTE_HUES).toContain(tagHue('payments'));
  });
});

describe('progressValue', () => {
  it('clamps to 0-100 and rounds', () => {
    expect(progressValue(-5)).toBe(0);
    expect(progressValue(140)).toBe(100);
    expect(progressValue(33.6)).toBe(34);
  });
});

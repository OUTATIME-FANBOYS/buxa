import { describe, expect, it } from 'vitest';
import { avatarHue, KIND_TONE } from '@/components/ui/tones';
import { progressValue } from '@/components/ui/Progress';

describe('KIND_TONE', () => {
  it('maps every column kind to a tone', () => {
    expect(KIND_TONE).toEqual({ open: 'neutral', active: 'brand', done: 'ok' });
  });
});

describe('avatarHue', () => {
  it('is stable for a name and always one of the person hues', () => {
    expect(avatarHue('Maya Chen')).toBe(avatarHue('Maya Chen'));
    for (const n of ['A', 'Maya Chen', 'Jo', '', 'Zoë Ångström']) expect(['brand', 'ok', 'warn', 'neutral']).toContain(avatarHue(n));
  });
  it('is the char-code sum modulo four hues', () => {
    expect(avatarHue('A')).toBe('ok'); // 65 % 4 = 1
    expect(avatarHue('B')).toBe('warn'); // 66 % 4 = 2
    expect(avatarHue('')).toBe('brand'); // 0
  });
});

describe('progressValue', () => {
  it('clamps to 0-100 and rounds', () => {
    expect(progressValue(-5)).toBe(0);
    expect(progressValue(140)).toBe(100);
    expect(progressValue(33.6)).toBe(34);
  });
});

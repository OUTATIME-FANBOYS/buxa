import { describe, expect, it } from 'vitest';
import { avatarHue, KIND_TONE, PALETTE_HUES, ROLE_HUE, TONE_HUE } from '../tones';

describe('KIND_TONE', () => {
  it('maps every column kind to a tone', () => {
    expect(KIND_TONE).toEqual({ open: 'neutral', active: 'brand', done: 'ok' });
  });
});

describe('the pill hue maps', () => {
  it('give each tone its rainbow hue: ok green, warn orange, crit red, info blue, brand yellow, agent purple, neutral grey', () => {
    expect(TONE_HUE).toEqual({
      neutral: 'grey',
      brand: 'yellow',
      ok: 'green',
      warn: 'orange',
      crit: 'red',
      agent: 'purple',
      info: 'blue',
    });
  });
  it('keep the tones distinct from each other, so no two tones look alike', () => {
    expect(new Set(Object.values(TONE_HUE)).size).toBe(Object.keys(TONE_HUE).length);
  });
  it('give each camp role a hue, and the four roles that have a spare hue get it to themselves', () => {
    expect(ROLE_HUE).toEqual({
      'role-owner': 'violet',
      'role-admin': 'teal',
      'role-staff': 'lime',
      'role-viewer': 'blue',
      'role-teacher': 'orange',
      'role-guardian': 'pink',
      'role-camper': 'purple',
    });
    for (const hue of ['violet', 'teal', 'lime', 'pink']) {
      expect(Object.values(ROLE_HUE).filter(h => h === hue)).toHaveLength(1);
      expect(Object.values(TONE_HUE)).not.toContain(hue);
    }
  });
});

describe('avatarHue', () => {
  it('is stable for a name and always one of the person hues', () => {
    expect(avatarHue('Maya Chen')).toBe(avatarHue('Maya Chen'));
    for (const n of ['A', 'Maya Chen', 'Jo', '', 'Zoë Ångström']) {
      expect(PALETTE_HUES).toContain(avatarHue(n));
    }
  });
  it('is the char-code sum modulo the five palette hues', () => {
    expect(avatarHue('A')).toBe('brand'); // 65 % 5 = 0
    expect(avatarHue('B')).toBe('ok'); // 66 % 5 = 1
    expect(avatarHue('')).toBe('brand'); // 0
  });
});

import { describe, expect, it } from 'vitest';
import {
  GATE_CODE_COOLDOWN_SECONDS,
  codeCooldownPassed,
  codeExpiresAt,
  decideGateCode,
  deviceExpiresAt,
  looksLikeGateEmail,
  normaliseGateEmail,
} from './rules';

const NOW = new Date('2027-07-01T09:00:00Z');
const minutesFrom = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

describe('gate emails', () => {
  it('compares emails trimmed and lower case', () => {
    expect(normaliseGateEmail('  Ann.Lee@Example.TEST ')).toBe('ann.lee@example.test');
  });

  it('checks only the shape of an address', () => {
    expect(looksLikeGateEmail('ann@example.test')).toBe(true);
    expect(looksLikeGateEmail('not an email')).toBe(false);
    expect(looksLikeGateEmail('ann@')).toBe(false);
  });
});

describe('gate codes: what a submitted code does', () => {
  it('accepts the code that matches while it is live', () => {
    expect(decideGateCode({ expiresAt: minutesFrom(10), attempts: 0 }, NOW, true)).toEqual({ kind: 'ok' });
  });

  it('counts a wrong code as one attempt and keeps the code live', () => {
    expect(decideGateCode({ expiresAt: minutesFrom(10), attempts: 0 }, NOW, false)).toEqual({
      kind: 'wrong',
      attempts: 1,
    });
    expect(decideGateCode({ expiresAt: minutesFrom(10), attempts: 3 }, NOW, false)).toEqual({
      kind: 'wrong',
      attempts: 4,
    });
  });

  it('voids the code on the fifth wrong attempt', () => {
    expect(decideGateCode({ expiresAt: minutesFrom(10), attempts: 4 }, NOW, false)).toEqual({ kind: 'void' });
  });

  it('refuses a void code even when the code would match', () => {
    expect(decideGateCode({ expiresAt: minutesFrom(10), attempts: 5 }, NOW, true)).toEqual({ kind: 'refused' });
  });

  it('refuses a code once ten minutes have passed, matching or not', () => {
    expect(decideGateCode({ expiresAt: minutesFrom(10), attempts: 0 }, minutesFrom(10), true)).toEqual({
      kind: 'refused',
    });
    expect(decideGateCode({ expiresAt: minutesFrom(10), attempts: 0 }, minutesFrom(9.9), true)).toEqual({ kind: 'ok' });
  });

  it('refuses when there is no code at all', () => {
    expect(decideGateCode(null, NOW, true)).toEqual({ kind: 'refused' });
  });

  it('sends a code that expires ten minutes after it is sent', () => {
    expect(codeExpiresAt(NOW).getTime() - NOW.getTime()).toBe(10 * 60_000);
  });
});

describe('gate codes: the cool-down between requests', () => {
  it('lets the first request through', () => {
    expect(codeCooldownPassed(null, NOW)).toBe(true);
  });

  it('holds a second request for 60 seconds', () => {
    const last = new Date(NOW.getTime() - (GATE_CODE_COOLDOWN_SECONDS - 1) * 1000);
    expect(codeCooldownPassed(last, NOW)).toBe(false);
    expect(codeCooldownPassed(new Date(NOW.getTime() - GATE_CODE_COOLDOWN_SECONDS * 1000), NOW)).toBe(true);
  });
});

describe('device tokens: how long they last', () => {
  it('lasts until the season end when that is still ahead', () => {
    const seasonEnd = new Date('2027-08-31T00:00:00Z');
    expect(deviceExpiresAt(seasonEnd, NOW)).toEqual(seasonEnd);
  });

  it('lasts 180 days when the camp has no season end, or it has passed', () => {
    const day = 86_400_000;
    expect(deviceExpiresAt(null, NOW).getTime() - NOW.getTime()).toBe(180 * day);
    expect(deviceExpiresAt(new Date('2026-01-01T00:00:00Z'), NOW).getTime() - NOW.getTime()).toBe(180 * day);
  });
});

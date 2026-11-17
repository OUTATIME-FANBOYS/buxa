import { describe, expect, it } from 'vitest';
import { formatCampDateTime, formatCampTime } from '../time';

// 08:12 UTC in November: London is on GMT (same clock), Kolkata is +05:30, Auckland is on daylight time (+13:00).
const instant = '2026-11-13T08:12:00Z';

describe('formatCampTime, 24-hour', () => {
  it('shows the wall clock of the camp zone, not UTC or the server zone', () => {
    expect(formatCampTime(instant, 'Asia/Kolkata', '24h')).toBe('13:42');
    expect(formatCampTime(instant, 'Pacific/Auckland', '24h')).toBe('21:12');
    expect(formatCampTime(instant, 'UTC', '24h')).toBe('08:12');
  });

  it('uses leading zeros, and midnight is 00:05', () => {
    expect(formatCampTime('2026-11-13T00:05:00Z', 'UTC', '24h')).toBe('00:05');
  });

  it('moves to the next day with the zone when it crosses midnight', () => {
    expect(formatCampTime('2026-11-13T20:30:00Z', 'Asia/Kolkata', '24h')).toBe('02:00');
  });

  it('shows noon as 12:00', () => {
    expect(formatCampTime('2026-11-13T12:00:00Z', 'UTC', '24h')).toBe('12:00');
  });
});

describe('formatCampTime, 12-hour', () => {
  it('shows the camp zone wall clock with AM or PM', () => {
    expect(formatCampTime(instant, 'Asia/Kolkata', '12h')).toBe('1:42 PM');
    expect(formatCampTime(instant, 'Pacific/Auckland', '12h')).toBe('9:12 PM');
    expect(formatCampTime(instant, 'UTC', '12h')).toBe('8:12 AM');
  });

  it('shows midnight as 12:00 AM, not 0:00', () => {
    expect(formatCampTime('2026-11-13T00:00:00Z', 'UTC', '12h')).toBe('12:00 AM');
    expect(formatCampTime('2026-11-13T00:05:00Z', 'UTC', '12h')).toBe('12:05 AM');
  });

  it('shows noon as 12:00 PM, not 0:00 PM', () => {
    expect(formatCampTime('2026-11-13T12:00:00Z', 'UTC', '12h')).toBe('12:00 PM');
    expect(formatCampTime('2026-11-13T12:30:00Z', 'UTC', '12h')).toBe('12:30 PM');
  });

  it('moves to the next day with the zone when it crosses midnight', () => {
    expect(formatCampTime('2026-11-13T20:30:00Z', 'Asia/Kolkata', '12h')).toBe('2:00 AM');
  });
});

describe('formatCampDateTime', () => {
  it('shows the camp-local day and a 24-hour time', () => {
    expect(formatCampDateTime('2026-11-13T20:30:00Z', 'Asia/Kolkata', '24h')).toBe('14 Nov, 02:00');
  });

  it('shows the camp-local day and a 12-hour time', () => {
    expect(formatCampDateTime('2026-11-13T20:30:00Z', 'Asia/Kolkata', '12h')).toBe('14 Nov, 2:00 AM');
    expect(formatCampDateTime('2026-11-13T12:00:00Z', 'UTC', '12h')).toBe('13 Nov, 12:00 PM');
  });
});

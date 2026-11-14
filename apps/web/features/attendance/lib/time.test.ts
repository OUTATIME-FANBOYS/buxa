import { describe, expect, it } from 'vitest';
import { formatCampDateTime, formatCampTime } from './time';

// 08:12 UTC in November: London is on GMT (same clock), Kolkata is +05:30, Auckland is on daylight time (+13:00).
const instant = '2026-11-13T08:12:00Z';

describe('formatCampTime', () => {
  it('shows the wall clock of the camp zone, not UTC or the server zone', () => {
    expect(formatCampTime(instant, 'Asia/Kolkata')).toBe('13:42');
    expect(formatCampTime(instant, 'Pacific/Auckland')).toBe('21:12');
    expect(formatCampTime(instant, 'UTC')).toBe('08:12');
  });

  it('uses 24-hour times with a leading zero', () => {
    expect(formatCampTime('2026-11-13T00:05:00Z', 'UTC')).toBe('00:05');
  });

  it('moves to the next day with the zone when it crosses midnight', () => {
    expect(formatCampTime('2026-11-13T20:30:00Z', 'Asia/Kolkata')).toBe('02:00');
  });
});

describe('formatCampDateTime', () => {
  it('shows the camp-local day and time', () => {
    const text = formatCampDateTime('2026-11-13T20:30:00Z', 'Asia/Kolkata');
    expect(text).toContain('14');
    expect(text).toContain('Nov');
    expect(text).toContain('02:00');
  });
});

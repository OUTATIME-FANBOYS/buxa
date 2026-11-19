/** How times are written for the whole camp: a 12-hour clock with AM/PM, or a 24-hour clock. */
export const CLOCK_FORMATS = ['12h', '24h'] as const;
export type ClockFormat = (typeof CLOCK_FORMATS)[number];

/** Used when nobody has chosen. It matches how times were always shown. */
export const DEFAULT_CLOCK_FORMAT: ClockFormat = '24h';

export function isClockFormat(value: unknown): value is ClockFormat {
  return typeof value === 'string' && (CLOCK_FORMATS as readonly string[]).includes(value);
}

/**
 * A calendar day with no time and no zone, as `YYYY-MM-DD`. Memberships are date ranges in the camp's local time, so "today"
 * is always computed with `toLocalDate(instant, camp.timezone)`, never from the server's clock zone.
 * ISO dates sort as text, so comparing the strings compares the days.
 */
export type LocalDate = string;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar day (rejects 2027-02-30). */
export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const m = LOCAL_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

/** Used when nobody has said otherwise (a camp created without JavaScript). Admins can change it. */
export const DEFAULT_TIMEZONE = 'UTC';

/** True for an IANA zone name this runtime knows ("America/Los_Angeles"). */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
}

/** The calendar day it is at `instant` in `timeZone`. */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

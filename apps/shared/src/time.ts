import type { ClockFormat } from '@buxa/domain';

/**
 * Times on screen are always the camp's local time, from its IANA zone (`orgs.timezone`), never the server's or the browser's zone.
 * Every caller passes the camp's zone and the signed-in person's clock format explicitly; there are no defaults.
 */

/** "09:05" from an instant, in the camp's zone, on a 24-hour clock. */
function clock24(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(instant),
  );
}

/** "09:05" becomes "9:05 AM", "00:05" becomes "12:05 AM", "12:00" becomes "12:00 PM". */
function clock12(hhmm: string): string {
  const [hours, minutes] = hhmm.split(':');
  const hour = Number(hours);

  return `${hour % 12 || 12}:${minutes} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** The camp's wall-clock time, for example "09:05" (24-hour) or "9:05 AM" (12-hour). */
export function formatCampTime(instant: string, timeZone: string, clockFormat: ClockFormat): string {
  const hhmm = clock24(instant, timeZone);

  return clockFormat === '12h' ? clock12(hhmm) : hhmm;
}

/** Day and time, for example "13 Nov, 09:12" (24-hour) or "13 Nov, 9:12 AM" (12-hour). */
export function formatCampDateTime(instant: string, timeZone: string, clockFormat: ClockFormat): string {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' }).format(new Date(instant));

  return `${day}, ${formatCampTime(instant, timeZone, clockFormat)}`;
}

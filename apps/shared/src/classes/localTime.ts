import { pad } from '../dates';

/*
 * Class times in the browser's own zone. The New class and Edit class forms show and type a local date-time (YYYY-MM-DDTHH:MM, in
 * the zone of the device) and send the instant it names (an ISO string in UTC). The server stores instants. The day boundaries (a
 * class must fall on days inside its session) stay in the camp's zone on the server; this file does not decide days.
 */

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** The local date-time input value (YYYY-MM-DDTHH:MM) of an instant, in the browser's zone. */
export function instantToLocalInput(iso: string): string {
  const d = new Date(iso);

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The UTC instant (ISO, with a Z) that a local date-time names in the browser's zone. Returns null when the text is not a
 * date-time, or when the local time does not exist: when clocks go forward, the hour that is skipped is refused rather than
 * saved as a different time. A repeated hour (clocks going back) is read as its first occurrence.
 */
export function localInputToInstant(value: string): string | null {
  const match = LOCAL_DATE_TIME.exec(value.trim());
  if (!match) {
    return null;
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number];
  const d = new Date(year, month - 1, day, hour, minute);
  const exists =
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day &&
    d.getHours() === hour &&
    d.getMinutes() === minute;

  return exists ? d.toISOString() : null;
}

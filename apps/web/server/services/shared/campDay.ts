import { isLocalDate, toLocalDate, type LocalDate } from '@buxa/domain';
import type { Clock } from '../clock';

/** The camp's calendar day right now, in the camp's zone. Never the server's zone. */
export const campToday = (clock: Clock, timeZone: string): LocalDate => toLocalDate(clock(), timeZone);

/** The day after `day` (a pure calendar step, no zone involved). */
export function nextLocalDay(day: LocalDate): LocalDate {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Wall-clock time in `timeZone` at `ms`, as if it were UTC; minus `ms` it is the zone's offset. */
function zoneOffsetMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms));
  const value = (type: string): number => Number(parts.find(p => p.type === type)?.value);
  const wall = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return wall - Math.floor(ms / 1000) * 1000;
}

/**
 * The instant (ISO) at which camp-local `day` starts in `timeZone`. Two passes settle daylight-saving changes at midnight.
 */
export function localDayStart(day: LocalDate, timeZone: string): string {
  if (!isLocalDate(day)) throw new Error(`Not a local date: ${day}`);
  const [y, m, d] = day.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d);
  const first = wall - zoneOffsetMs(wall, timeZone);
  return new Date(wall - zoneOffsetMs(first, timeZone)).toISOString();
}

/** A window of instants covering the camp-local days `from` to `to` inclusive: `from` inclusive, `to` exclusive. */
export function localDaysWindow(from: LocalDate, to: LocalDate, timeZone: string): { from: string; to: string } {
  return { from: localDayStart(from, timeZone), to: localDayStart(nextLocalDay(to), timeZone) };
}

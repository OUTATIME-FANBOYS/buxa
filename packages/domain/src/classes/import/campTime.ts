/**
 * Camp-local times in an import file. A time is written as the camp's clock reads it (`2027-07-05T09:00`), with no offset, and is
 * converted to an instant using the camp's zone. The offset is looked up for that moment, so daylight saving is handled.
 */

export type CampTime = { ok: true; instant: string } | { ok: false; message: string };

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

/** How far the zone's wall clock is ahead of UTC at `utcMs`, in milliseconds. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const field = (type: string): number => Number(parts.find(p => p.type === type)?.value);
  const wallAsUtc = Date.UTC(field('year'), field('month') - 1, field('day'), field('hour'), field('minute'), field('second'));
  return wallAsUtc - (utcMs - (utcMs % 1000));
}

export function parseCampLocal(value: string, timeZone: string): CampTime {
  const text = value.trim();
  if (text === '') return { ok: false, message: 'Enter a date and time.' };
  const m = LOCAL.exec(text);
  if (!m) {
    if (HAS_OFFSET.test(text) && text.includes('T')) {
      return { ok: false, message: 'Leave off the time zone. Times are in the camp\'s time zone.' };
    }
    return { ok: false, message: 'Use the format 2027-07-05T09:00 (camp time).' };
  }
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number) as [number, number, number, number, number, number];
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const probe = new Date(wall);
  const isRealDay = probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
  if (!isRealDay || hour > 23 || minute > 59 || second > 59) return { ok: false, message: 'That date or time does not exist.' };

  // Two passes: the second one corrects the offset when the first guess landed on the other side of a daylight-saving change.
  const first = wall - zoneOffsetMs(wall, timeZone);
  const instant = wall - zoneOffsetMs(first, timeZone);
  return { ok: true, instant: new Date(instant).toISOString() };
}

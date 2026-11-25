import type { Series } from '@buxa/contracts';
import type { OccurrenceStatus } from '@buxa/domain';
import type { SeriesFields } from './ClassRepository';

/** A series as the in-memory repository stores it: its shared fields and its id and session. */
export interface SeriesSource extends SeriesFields {
  id: string;
  sessionId: string;
  weekdays: number[];
}

/** One day of a series, as the in-memory repository stores it. */
export interface SeriesDay {
  id: string;
  startsAt: string;
  endsAt: string;
  status: OccurrenceStatus;
}

/** The counts and names a series view reads from the rest of the store. */
export interface SeriesPlaces {
  seatsTaken(classId: string): number;
  waitlisted(classId: string): number;
  instructorName(personId: string): string;
}

/**
 * Builds the Series read model from a series and its days, the way the Postgres read does (migrations 0060 and 0061): clock times and
 * days in the camp's zone, counts per day, the anchor the first active day (or the first day), and the seats and the waitlist of the
 * anchor, which count the whole series. `days` are in start order.
 */
export function seriesView(
  source: SeriesSource,
  days: readonly SeriesDay[],
  sessionName: string,
  timeZone: string,
  places: SeriesPlaces,
): Series {
  const first = days[0];
  const last = days[days.length - 1];
  const active = days.find(d => d.status === 'active') ?? first;
  const weekdays =
    source.weekdays.length > 0
      ? [...source.weekdays]
      : [...new Set(days.map(d => isoWeekday(d.startsAt, timeZone)))].sort((a, b) => a - b);

  return {
    id: source.id,
    sessionId: source.sessionId,
    sessionName,
    name: source.name,
    ageRange: { ...source.ageRange },
    capacity: source.capacity,
    location: source.location,
    weekdays,
    startTime: first ? clock(first.startsAt, timeZone) : '',
    endTime: first ? clock(first.endsAt, timeZone) : '',
    firstDay: first ? day(first.startsAt, timeZone) : '',
    lastDay: last ? day(last.startsAt, timeZone) : '',
    occurrenceCount: days.length,
    activeOccurrenceCount: days.filter(d => d.status === 'active').length,
    anchorClassId: active?.id ?? '',
    instructorIds: [...source.instructorIds],
    instructors: source.instructorIds.map(id => ({ id, name: places.instructorName(id) })),
    price: source.price ? { ...source.price } : null,
    seatsTaken: first ? places.seatsTaken(first.id) : 0,
    waitlisted: first ? places.waitlisted(first.id) : 0,
  };
}

function parts(iso: string, timeZone: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))) {
    out[part.type] = part.value;
  }

  return out;
}

const clock = (iso: string, timeZone: string): string => {
  const p = parts(iso, timeZone);

  return `${p.hour ?? ''}:${p.minute ?? ''}`;
};

const day = (iso: string, timeZone: string): string => {
  const p = parts(iso, timeZone);

  return `${p.year ?? ''}-${p.month ?? ''}-${p.day ?? ''}`;
};

/** ISO weekday (1 Monday to 7 Sunday) of an instant in the camp's zone. */
function isoWeekday(iso: string, timeZone: string): number {
  const [y, m, d] = day(iso, timeZone).split('-').map(Number);
  const weekday = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();

  return weekday === 0 ? 7 : weekday;
}

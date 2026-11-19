import { parseCampLocal } from './import/campTime';

/*
 * Recurring classes: a weekly rule (chosen weekdays, from a first day to an end date or a count) expands into the classes it
 * stands for. Pure: it reads nothing and writes nothing. Each occurrence is then checked and written like a manual class, so
 * the overlap and capacity rules apply to every one of them.
 *
 * Times are the camp's wall clock. A 09:00 class stays at 09:00 local across daylight saving, so the UTC instant moves with the
 * clock change and the local time does not. An end time at or before the start time means the class ends the next day
 * (a class that crosses midnight).
 */

export const MAX_RECURRING_CLASSES = 100;
/** The longest window a rule may scan. Two years covers any count up to MAX_RECURRING_CLASSES of a weekly rule. */
export const MAX_RECURRENCE_DAYS = 731;

export type RecurrenceEnd = { kind: 'until'; date: string } | { kind: 'count'; count: number };

export interface ClassRule {
  /** ISO weekdays: 1 is Monday, 7 is Sunday. At least one. */
  weekdays: readonly number[];
  /** The first day the rule may place a class, camp-local, YYYY-MM-DD. */
  firstDate: string;
  /** Camp-local start and end clock times, HH:MM. */
  startTime: string;
  endTime: string;
  end: RecurrenceEnd;
}

export interface Occurrence {
  /** The camp-local day the class starts on, YYYY-MM-DD. */
  date: string;
  startsAt: string;
  endsAt: string;
}

export type ExpandResult = { ok: true; occurrences: Occurrence[] } | { ok: false; message: string };

const DAY_MS = 86_400_000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Parses a real calendar day into UTC midnight, or null when the text is not a day that exists. */
function parseDay(text: string): number | null {
  const m = DATE.exec(text);
  if (!m) {
    return null;
  }
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const probe = new Date(ms);
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null;
  }

  return ms;
}

const formatDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** ISO weekday (1 Monday to 7 Sunday) of a UTC-midnight day. */
function isoWeekday(ms: number): number {
  const day = new Date(ms).getUTCDay();

  return day === 0 ? 7 : day;
}

/**
 * Expands the rule into its occurrences, in date order. Refuses (with a message the screen can show) a rule that is incomplete,
 * that ends before it starts, that asks for more than MAX_RECURRING_CLASSES, or that cannot be placed within the window.
 */
export function expandClassRule(rule: ClassRule, timeZone: string): ExpandResult {
  const weekdays = new Set(rule.weekdays);
  if (weekdays.size === 0 || [...weekdays].some(w => !Number.isInteger(w) || w < 1 || w > 7)) {
    return { ok: false, message: 'Choose at least one day of the week.' };
  }
  const first = parseDay(rule.firstDate);
  if (first === null) {
    return { ok: false, message: 'Use a real first date, in the format 2027-07-05.' };
  }
  if (!CLOCK.test(rule.startTime) || !CLOCK.test(rule.endTime)) {
    return { ok: false, message: 'Use 24-hour times, in the format 09:00.' };
  }
  if (rule.startTime === rule.endTime) {
    return { ok: false, message: 'The class must end after it starts.' };
  }
  const crossesMidnight = rule.endTime < rule.startTime;

  let lastDay: number;
  let limit: number | null = null;
  if (rule.end.kind === 'until') {
    const until = parseDay(rule.end.date);
    if (until === null) {
      return { ok: false, message: 'Use a real end date, in the format 2027-08-31.' };
    }
    if (until < first) {
      return { ok: false, message: 'The last date cannot be before the first date.' };
    }
    if ((until - first) / DAY_MS > MAX_RECURRENCE_DAYS) {
      return { ok: false, message: 'A recurring series can run for two years at most.' };
    }
    lastDay = until;
  } else {
    const count = rule.end.count;
    if (!Number.isInteger(count) || count < 1 || count > MAX_RECURRING_CLASSES) {
      return { ok: false, message: `A series has between 1 and ${MAX_RECURRING_CLASSES} classes.` };
    }
    limit = count;
    lastDay = first + MAX_RECURRENCE_DAYS * DAY_MS;
  }

  const occurrences: Occurrence[] = [];
  for (let day = first; day <= lastDay; day += DAY_MS) {
    if (!weekdays.has(isoWeekday(day))) {
      continue;
    }
    if (limit !== null && occurrences.length === limit) {
      break;
    }
    if (occurrences.length === MAX_RECURRING_CLASSES) {
      return { ok: false, message: `A series has at most ${MAX_RECURRING_CLASSES} classes. Shorten the dates.` };
    }
    const date = formatDay(day);
    const endDate = crossesMidnight ? formatDay(day + DAY_MS) : date;
    const start = parseCampLocal(`${date}T${rule.startTime}`, timeZone);
    const end = parseCampLocal(`${endDate}T${rule.endTime}`, timeZone);
    if (!start.ok || !end.ok) {
      return { ok: false, message: 'That time does not exist on one of the days. Choose another time.' };
    }
    occurrences.push({ date, startsAt: start.instant, endsAt: end.instant });
  }

  if (limit !== null && occurrences.length < limit) {
    return { ok: false, message: 'The rule cannot place that many classes within two years. Lower the count.' };
  }
  if (occurrences.length === 0) {
    return { ok: false, message: 'No class falls in that range. Check the days and dates.' };
  }

  return { ok: true, occurrences };
}

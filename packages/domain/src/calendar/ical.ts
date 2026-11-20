/*
 * The read-only iCal feed (RFC 5545). Pure: it turns a camp's classes into text and reads nothing. The route reads the classes
 * and checks the token; this file only writes the calendar.
 *
 * Each class is one VEVENT. Its UID is derived from the class id, so a calendar app updates the same event when the class
 * changes instead of adding a new one. Times are written in UTC (the Z form), so no VTIMEZONE block is needed.
 */

export interface FeedClass {
  id: string;
  className: string;
  /** ISO instants with an offset, as stored. */
  startsAt: string;
  endsAt: string;
  location: string;
}

export interface FeedInput {
  /** Used for the calendar's name. */
  campName: string;
  classes: readonly FeedClass[];
  /** When the feed was generated. DTSTAMP on every event. */
  generatedAt: Date;
  /** Identifies this product in PRODID. */
  productId?: string;
}

const CRLF = '\r\n';
const MAX_LINE_OCTETS = 75;
const DEFAULT_PRODUCT = '-//Buxa//Camp calendar//EN';

/** Escapes a TEXT value (RFC 5545 section 3.3.11): backslash, semicolon, comma and newline. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Folds a content line so no physical line is longer than 75 octets: continuation lines start with one space. A multi-byte
 * character is never split across two lines.
 */
export function foldLine(line: string): string {
  const pieces: string[] = [];
  let current = '';
  let currentOctets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const ch of line) {
    const octets = Buffer.byteLength(ch, 'utf8');
    if (currentOctets + octets > limit) {
      pieces.push(current);
      current = '';
      currentOctets = 0;
      // Continuation lines carry a leading space, which counts toward their 75 octets.
      limit = MAX_LINE_OCTETS - 1;
    }
    current += ch;
    currentOctets += octets;
  }
  pieces.push(current);

  return pieces.join(`${CRLF} `);
}

/** A UTC instant in the basic form: 20270705T090000Z. */
export function formatUtc(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Not a time: ${String(value)}`);
  }
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');

  return (
    `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** A stable UID per class. The domain is fixed so the UID never depends on the host the feed is read from. */
export function classUid(classId: string): string {
  return `class-${classId}@buxa`;
}

function property(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

function event(item: FeedClass, generatedAt: Date): string[] {
  return [
    'BEGIN:VEVENT',
    property('UID', classUid(item.id)),
    property('DTSTAMP', formatUtc(generatedAt)),
    property('DTSTART', formatUtc(item.startsAt)),
    property('DTEND', formatUtc(item.endsAt)),
    property('SUMMARY', escapeText(item.className)),
    property('LOCATION', escapeText(item.location)),
    'END:VEVENT',
  ];
}

/**
 * The whole calendar as text, with CRLF line endings. Classes are written in start order, then by id, so the same data always
 * gives the same bytes. An empty camp gives a valid calendar with no events.
 */
export function serializeCalendar(input: FeedInput): string {
  const ordered = [...input.classes].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id),
  );
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    property('PRODID', input.productId ?? DEFAULT_PRODUCT),
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    property('X-WR-CALNAME', escapeText(input.campName)),
  ];
  for (const item of ordered) {
    lines.push(...event(item, input.generatedAt));
  }
  lines.push('END:VCALENDAR');

  return lines.join(CRLF) + CRLF;
}

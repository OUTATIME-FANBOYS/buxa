import { describe, expect, it } from 'vitest';
import { escapeText, foldLine, formatUtc, serializeCalendar, classUid, type FeedClass } from './ical';

const GENERATED = new Date('2027-07-01T00:00:00Z');
const ROBOTICS: FeedClass = {
  id: '6f1c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f',
  className: 'Robotics',
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Lab 1',
};

const unfold = (text: string) => text.replace(/\r\n[ \t]/g, '');
const lines = (text: string) =>
  unfold(text)
    .split('\r\n')
    .filter(l => l !== '');

describe('formatUtc', () => {
  it('writes the basic UTC form, whatever offset the instant came in with', () => {
    expect(formatUtc('2027-07-05T09:00:00+10:00')).toBe('20270704T230000Z');
    expect(formatUtc(new Date('2027-01-02T03:04:05Z'))).toBe('20270102T030405Z');
  });

  it('refuses a value that is not a time rather than writing a broken one', () => {
    expect(() => formatUtc('not a time')).toThrow(/Not a time/);
  });
});

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and newline, in that order', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });

  it('leaves ordinary text alone, including accents and punctuation that needs no escape', () => {
    expect(escapeText('Crème brûlée & art: 9-12')).toBe('Crème brûlée & art: 9-12');
  });
});

describe('foldLine', () => {
  it('keeps a short line on one physical line', () => {
    expect(foldLine('SUMMARY:Robotics')).toBe('SUMMARY:Robotics');
  });

  it('folds at 75 octets with a leading space on each continuation, and unfolds to the original', () => {
    const long = `SUMMARY:${'x'.repeat(200)}`;
    const folded = foldLine(long);
    for (const physical of folded.split('\r\n')) {
      expect(Buffer.byteLength(physical, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(folded.split('\r\n')[1].startsWith(' ')).toBe(true);
    expect(unfold(folded)).toBe(long);
  });

  it('never splits a multi-byte character across lines', () => {
    const long = `SUMMARY:${'é'.repeat(100)}`; // 2 octets each
    const folded = foldLine(long);
    for (const physical of folded.split('\r\n')) {
      expect(Buffer.byteLength(physical, 'utf8')).toBeLessThanOrEqual(75);
      expect(physical).not.toMatch(/�/);
    }
    expect(unfold(folded)).toBe(long);
  });

  it('folds a line of 4-octet characters (emoji) without breaking a character', () => {
    const long = `SUMMARY:${'🎨'.repeat(40)}`;
    const folded = foldLine(long);
    expect(unfold(folded)).toBe(long);
    for (const physical of folded.split('\r\n')) {
      expect(Buffer.byteLength(physical, 'utf8')).toBeLessThanOrEqual(75);
    }
  });
});

describe('classUid', () => {
  it('is stable for a class id and differs between classes', () => {
    expect(classUid(ROBOTICS.id)).toBe(classUid(ROBOTICS.id));
    expect(classUid(ROBOTICS.id)).toBe(`class-${ROBOTICS.id}@buxa`);
    expect(classUid('11111111-1111-4111-8111-111111111111')).not.toBe(classUid(ROBOTICS.id));
  });
});

describe('serializeCalendar', () => {
  it('writes a VCALENDAR with one VEVENT per class, in UTC, with the class name as SUMMARY', () => {
    const text = serializeCalendar({ campName: 'Camp Pine', classes: [ROBOTICS], generatedAt: GENERATED });
    const out = lines(text);

    expect(out[0]).toBe('BEGIN:VCALENDAR');
    expect(out).toContain('VERSION:2.0');
    expect(out).toContain('X-WR-CALNAME:Camp Pine');
    expect(out).toContain('BEGIN:VEVENT');
    expect(out).toContain(`UID:class-${ROBOTICS.id}@buxa`);
    expect(out).toContain('DTSTAMP:20270701T000000Z');
    expect(out).toContain('DTSTART:20270704T230000Z');
    expect(out).toContain('DTEND:20270705T020000Z');
    expect(out).toContain('SUMMARY:Robotics');
    expect(out).toContain('LOCATION:Lab 1');
    expect(out.at(-1)).toBe('END:VCALENDAR');
  });

  it('uses CRLF line endings throughout and ends with one', () => {
    const text = serializeCalendar({ campName: 'Camp', classes: [ROBOTICS], generatedAt: GENERATED });

    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('gives a valid empty calendar for a camp with no classes', () => {
    const text = serializeCalendar({ campName: 'Camp', classes: [], generatedAt: GENERATED });

    expect(lines(text)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Buxa//Camp calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Camp',
      'END:VCALENDAR',
    ]);
    expect(text).not.toContain('VEVENT');
  });

  it('keeps the UID stable when a class changes its time', () => {
    const before = serializeCalendar({ campName: 'Camp', classes: [ROBOTICS], generatedAt: GENERATED });
    const moved = serializeCalendar({
      campName: 'Camp',
      classes: [{ ...ROBOTICS, startsAt: '2027-07-05T00:00:00.000Z', endsAt: '2027-07-05T03:00:00.000Z' }],
      generatedAt: GENERATED,
    });

    const uid = `UID:class-${ROBOTICS.id}@buxa`;
    expect(lines(before)).toContain(uid);
    expect(lines(moved)).toContain(uid);
    expect(lines(moved)).toContain('DTSTART:20270705T000000Z');
  });

  it('orders events by start time, then id, so the same data gives the same bytes', () => {
    const later: FeedClass = {
      ...ROBOTICS,
      id: 'aaaaaaaa-0000-4000-8000-000000000001',
      startsAt: '2027-07-12T00:00:00.000Z',
      endsAt: '2027-07-12T03:00:00.000Z',
    };
    const a = serializeCalendar({ campName: 'Camp', classes: [later, ROBOTICS], generatedAt: GENERATED });
    const b = serializeCalendar({ campName: 'Camp', classes: [ROBOTICS, later], generatedAt: GENERATED });

    expect(a).toBe(b);
    expect(lines(a).indexOf(`UID:class-${ROBOTICS.id}@buxa`)).toBeLessThan(
      lines(a).indexOf(`UID:class-${later.id}@buxa`),
    );
  });

  it('escapes the class name and location so a comma or semicolon cannot end the field', () => {
    const text = serializeCalendar({
      campName: 'Camp; Pine, East',
      classes: [{ ...ROBOTICS, className: 'Art, Clay; Wheel', location: 'Shed\n2' }],
      generatedAt: GENERATED,
    });
    const out = lines(text);

    expect(out).toContain('X-WR-CALNAME:Camp\\; Pine\\, East');
    expect(out).toContain('SUMMARY:Art\\, Clay\\; Wheel');
    expect(out).toContain('LOCATION:Shed\\n2');
  });

  it('spans midnight and month end in UTC without shifting the local day (DTSTART is the instant)', () => {
    const text = serializeCalendar({
      campName: 'Camp',
      classes: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          className: 'Night sky',
          startsAt: '2027-07-31T22:00:00.000Z',
          endsAt: '2027-08-01T01:00:00.000Z',
          location: 'Field',
        },
      ],
      generatedAt: GENERATED,
    });

    expect(lines(text)).toContain('DTSTART:20270731T220000Z');
    expect(lines(text)).toContain('DTEND:20270801T010000Z');
  });
});

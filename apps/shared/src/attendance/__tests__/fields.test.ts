import { describe, expect, it } from 'vitest';
import { ATTENDANCE_FIELD_IDS, ATTENDANCE_FIELD_LABELS, type AttendanceEntry } from '@buxa/contracts';
import { attendanceFieldValue } from '../fields';

const display = { timeZone: 'Europe/London', clockFormat: '24h' } as const;
const entry: AttendanceEntry = {
  id: 'v1',
  personId: 'p1',
  personName: 'Mia Cole',
  checkedInAt: '2027-07-03T09:00:00.000Z',
  checkedInByName: 'Rosa',
  method: 'qr',
  checkedOutAt: null,
  checkedOutByName: null,
  collectedByName: null,
  overrideReason: null,
  note: null,
  sessionName: 'Summer 1',
  className: 'Swim Juniors',
};

describe('attendance fields', () => {
  it('has one list of columns in table order, each with a label', () => {
    expect(ATTENDANCE_FIELD_IDS).toEqual([
      'person',
      'session',
      'class',
      'in',
      'out',
      'checkedInBy',
      'checkedOutBy',
      'collectedBy',
      'method',
      'overrideReason',
    ]);
    expect(Object.keys(ATTENDANCE_FIELD_LABELS)).toEqual([...ATTENDANCE_FIELD_IDS]);
  });

  it('shows the session and class names, or null when there are none', () => {
    expect(attendanceFieldValue(entry, 'session', display)).toBe('Summer 1');
    expect(attendanceFieldValue(entry, 'class', display)).toBe('Swim Juniors');
    const campDay = { ...entry, sessionName: null, className: null };
    expect(attendanceFieldValue(campDay, 'session', display)).toBeNull();
    expect(attendanceFieldValue(campDay, 'class', display)).toBeNull();
  });

  it('shows times in camp time, and "On site" for a visit still open', () => {
    // 09:00 UTC is 10:00 in London in July (British Summer Time).
    expect(attendanceFieldValue(entry, 'in', display)).toContain('10:00');
    expect(attendanceFieldValue(entry, 'out', display)).toBe('On site');
    const out = { ...entry, checkedOutAt: '2027-07-03T11:30:00.000Z' };
    expect(attendanceFieldValue(out, 'out', display)).toContain('12:30');
  });

  it('shows the method in the log words', () => {
    expect(attendanceFieldValue(entry, 'method', display)).toBe('Badge');
  });
});

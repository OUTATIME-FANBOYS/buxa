import { describe, expect, it } from 'vitest';
import { IMPORT_COLUMNS, type ImportColumn } from './columns';
import type { ImportRow } from './file';
import { planImport, type ClassRef, type ExistingSession } from './plan';

const TZ = 'Australia/Sydney';

const ROBOTICS: ClassRef = { id: 'cls-robotics', name: 'Robotics', ageRange: { minAge: 8, maxAge: 12 }, capacity: 2 };
const ART: ClassRef = { id: 'cls-art', name: 'Art', ageRange: { minAge: 6, maxAge: 14 }, capacity: 10 };

const VALID: Record<ImportColumn, string> = {
  external_key: '', class_name: 'Robotics', starts_at: '2027-07-05T13:00', ends_at: '2027-07-05T15:00', location: 'Lab 2',
  age_min: '8', age_max: '12', capacity: '2', instructor_names: '', ratio_campers: '', ratio_instructors: '',
};

let nextRow = 2;
/** A valid row, with overrides. Each call takes the next spreadsheet row number unless one is given. */
const row = (over: Partial<Record<ImportColumn, string>> = {}, rowNumber?: number): ImportRow => {
  const n = rowNumber ?? nextRow++;
  return { rowNumber: n, cells: { ...VALID, ...over } };
};

/** An existing session in the camp, Sydney local times on Mon 5 July 2027. */
const existing = (over: Partial<ExistingSession> & Pick<ExistingSession, 'id' | 'classId' | 'className' | 'startsAt' | 'endsAt'>): ExistingSession => ({
  location: 'Lab 1', capacity: 2, seatsTaken: 0, externalKey: null, ...over,
});
const SYDNEY_0900_1200 = existing({ id: 's-robotics-am', classId: 'cls-robotics', className: 'Robotics', startsAt: '2027-07-04T23:00:00.000Z', endsAt: '2027-07-05T02:00:00.000Z' });

const plan = (rows: ImportRow[], sessions: ExistingSession[] = [], classes: ClassRef[] = [ROBOTICS, ART]) =>
  planImport({ rows, classes, sessions, timeZone: TZ });

const only = (rows: ImportRow[], sessions: ExistingSession[] = [], classes?: ClassRef[]) => {
  const p = plan(rows, sessions, classes);
  return p.results.map(r => ({ row: r.rowNumber, status: r.status, problems: r.problems }));
};

describe('planImport: a valid row', () => {
  it('is ready to create, with the instant in UTC and the camp time read in the camp zone', () => {
    const p = plan([row({}, 2)]);
    expect(p.results).toEqual([expect.objectContaining({ rowNumber: 2, status: 'create', problems: [] })]);
    expect(p.writes).toEqual([expect.objectContaining({
      rowNumber: 2, kind: 'create', sessionId: null, classId: 'cls-robotics', startsAt: '2027-07-05T03:00:00.000Z',
      endsAt: '2027-07-05T05:00:00.000Z', location: 'Lab 2', capacity: 2, externalKey: null, instructorNames: [], ratio: null,
    })]);
    expect(p.counts).toEqual({ create: 1, update: 0, refused: 0 });
  });
});

describe('planImport: field checks (each row gets its own result)', () => {
  it.each<[string, Partial<Record<ImportColumn, string>>, ImportColumn, string]>([
    ['a missing class', { class_name: 'Chess' }, 'class_name', 'There is no class called "Chess". Create the class first: an import does not create classes.'],
    ['an empty class name', { class_name: '' }, 'class_name', 'Give the class name.'],
    ['an offset on the start time', { starts_at: '2027-07-05T13:00+10:00' }, 'starts_at', 'Leave off the time zone. Times are in the camp\'s time zone.'],
    ['an end before the start', { ends_at: '2027-07-05T12:00' }, 'ends_at', 'The session must end after it starts.'],
    ['an end equal to the start', { ends_at: '2027-07-05T13:00' }, 'ends_at', 'The session must end after it starts.'],
    ['a missing location', { location: '' }, 'location', 'Give the location.'],
    ['a non-number age', { age_min: 'eight' }, 'age_min', 'Enter the youngest age as a whole number.'],
    ['an age range upside down', { age_min: '12', age_max: '8' }, 'age_max', 'The youngest age cannot be above the oldest.'],
    ['ages that differ from the class', { age_min: '6', age_max: '12' }, 'age_min', 'Robotics is for ages 8 to 12. Use those ages.'],
    ['zero capacity', { capacity: '0' }, 'capacity', 'Capacity is a whole number of places, from 1 to 500.'],
    ['a capacity that is not a number', { capacity: 'two' }, 'capacity', 'Capacity is a whole number of places, from 1 to 500.'],
    ['an empty instructor between semicolons', { instructor_names: 'Ana;;Ben' }, 'instructor_names', 'Each instructor needs a name between the semicolons. Remove the empty one.'],
    ['a trailing semicolon', { instructor_names: 'Ana;' }, 'instructor_names', 'Each instructor needs a name between the semicolons. Remove the empty one.'],
    ['a ratio with only one half', { ratio_campers: '8' }, 'ratio_instructors', 'Give both ratio columns, or leave both empty.'],
    ['a zero ratio', { ratio_campers: '0', ratio_instructors: '1' }, 'ratio_campers', 'The ratio is a positive whole number of campers.'],
    ['an external key that is too long', { external_key: 'k'.repeat(101) }, 'external_key', 'Keep the external key under 100 characters.'],
  ])('refuses %s, naming the field', (_label, over, field, message) => {
    const p = plan([row(over, 2)]);
    expect(p.results[0]).toMatchObject({ status: 'refused', problems: [{ field, message }] });
    expect(p.writes).toEqual([]);
  });

  it('accepts a session with instructors and a ratio, and splits the names on semicolons', () => {
    const p = plan([row({ instructor_names: ' Ana ; Ben ', ratio_campers: '8', ratio_instructors: '1' }, 2)]);
    expect(p.writes[0]).toMatchObject({ instructorNames: ['Ana', 'Ben'], ratio: { campers: 8, instructors: 1 } });
  });

  it('refuses a class name that matches two classes, rather than guessing', () => {
    const p = plan([row({ class_name: 'art' }, 2)], [], [ART, { ...ART, id: 'cls-art-2' }]);
    expect(p.results[0]).toMatchObject({ status: 'refused', problems: [{ field: 'class_name', message: 'More than one class is called "art". Rename one of them first.' }] });
  });

  it('matches the class name ignoring case and surrounding spaces', () => {
    const p = plan([row({ class_name: '  robotics ' }, 2)]);
    expect(p.results[0]?.status).toBe('create');
  });
});

describe('planImport: clashes within the file', () => {
  it('refuses the later of two overlapping rows and names the earlier row', () => {
    const p = plan([row({}, 2), row({ class_name: 'Art', starts_at: '2027-07-05T14:00', ends_at: '2027-07-05T16:00', age_min: '6', age_max: '14', capacity: '10' }, 3)]);
    expect(p.results.map(r => r.status)).toEqual(['create', 'refused']);
    expect(p.results[1]?.problems).toEqual([{ field: 'starts_at', message: expect.stringContaining('Clashes with row 2 of this file') }]);
  });

  it('allows rows that only touch (one ends at 15:00, the next starts at 15:00)', () => {
    expect(only([row({}, 2), row({ class_name: 'Art', starts_at: '2027-07-05T15:00', ends_at: '2027-07-05T17:00', age_min: '6', age_max: '14', capacity: '10' }, 3)]))
      .toEqual([{ row: 2, status: 'create', problems: [] }, { row: 3, status: 'create', problems: [] }]);
  });

  it('detects a session that crosses midnight', () => {
    const late = row({ starts_at: '2027-07-05T23:00', ends_at: '2027-07-06T01:00', location: 'Lab 2' }, 2);
    const early = row({ class_name: 'Art', starts_at: '2027-07-06T00:30', ends_at: '2027-07-06T02:00', age_min: '6', age_max: '14', capacity: '10' }, 3);
    const p = plan([late, early]);
    expect(p.results[1]).toMatchObject({ status: 'refused', problems: [{ field: 'starts_at' }] });
  });

  it('refuses a row that is nested inside an earlier one', () => {
    const p = plan([row({ starts_at: '2027-07-05T09:00', ends_at: '2027-07-05T17:00' }, 2), row({ class_name: 'Art', starts_at: '2027-07-05T10:00', ends_at: '2027-07-05T11:00', age_min: '6', age_max: '14', capacity: '10' }, 3)]);
    expect(p.results[1]?.status).toBe('refused');
  });

  it('does not let a refused row block a later one', () => {
    const bad = row({ capacity: '0' }, 2);
    const same = row({}, 3);
    expect(only([bad, same])).toEqual([
      { row: 2, status: 'refused', problems: [{ field: 'capacity', message: expect.any(String) }] },
      { row: 3, status: 'create', problems: [] },
    ]);
  });
});

describe('planImport: clashes with sessions already in the camp', () => {
  it('refuses a clash with another class in the camp and names that session', () => {
    const artAm = existing({ id: 's-art', classId: 'cls-art', className: 'Art', startsAt: '2027-07-05T10:00:00+10:00', endsAt: '2027-07-05T12:00:00+10:00' });
    const p = plan([row({ starts_at: '2027-07-05T11:00', ends_at: '2027-07-05T13:00' }, 2)], [artAm]);
    expect(p.results[0]).toMatchObject({ status: 'refused', problems: [{ field: 'starts_at', message: expect.stringContaining('Clashes with Art') }] });
  });

  it('allows a row that starts exactly when an existing session ends', () => {
    const artAm = existing({ id: 's-art', classId: 'cls-art', className: 'Art', startsAt: '2027-07-05T10:00:00+10:00', endsAt: '2027-07-05T13:00:00+10:00' });
    expect(only([row({}, 2)], [artAm])).toEqual([{ row: 2, status: 'create', problems: [] }]);
  });

  it('detects a clash with an existing session that crosses midnight', () => {
    const night = existing({ id: 's-night', classId: 'cls-art', className: 'Art', startsAt: '2027-07-05T23:00:00+10:00', endsAt: '2027-07-06T01:00:00+10:00' });
    const p = plan([row({ starts_at: '2027-07-06T00:00', ends_at: '2027-07-06T00:30' }, 2)], [night]);
    expect(p.results[0]?.status).toBe('refused');
  });
});

describe('planImport: duplicates (rows without an external key)', () => {
  it('refuses a row that matches an existing session on class, start, end and location', () => {
    const p = plan([row({ starts_at: '2027-07-05T09:00', ends_at: '2027-07-05T12:00', location: 'Lab 1' }, 2)], [SYDNEY_0900_1200]);
    expect(p.results[0]).toMatchObject({ status: 'refused', problems: [{ field: 'starts_at', message: expect.stringContaining('already in the camp') }] });
  });

  it('matches the location ignoring case', () => {
    const p = plan([row({ starts_at: '2027-07-05T09:00', ends_at: '2027-07-05T12:00', location: 'LAB 1' }, 2)], [SYDNEY_0900_1200]);
    expect(p.results[0]?.status).toBe('refused');
  });

  it('is not a duplicate when the location differs', () => {
    const p = plan([row({ starts_at: '2027-07-05T09:00', ends_at: '2027-07-05T12:00', location: 'Lab 2' }, 2)], [SYDNEY_0900_1200]);
    expect(p.results[0]?.status).toBe('refused');
    expect(p.results[0]?.problems[0]?.message).toContain('Clashes');
  });

  it('refuses the second of two identical rows in one file, naming the first', () => {
    const same = { starts_at: '2027-07-05T13:00', ends_at: '2027-07-05T15:00', location: 'Lab 2' };
    const p = plan([row(same, 2), row(same, 3)]);
    expect(p.results[1]?.problems[0]?.message).toContain('row 2');
  });
});

describe('planImport: external keys (re-upload updates, never duplicates)', () => {
  const keyed = (key: string, over: Partial<Record<ImportColumn, string>> = {}, n?: number) => row({ external_key: key, ...over }, n);

  it('updates the session that has the same key, and does not clash with its own old time', () => {
    const withKey = { ...SYDNEY_0900_1200, externalKey: 'ROB-AM' };
    const p = plan([keyed('ROB-AM', { starts_at: '2027-07-05T09:00', ends_at: '2027-07-05T12:00', location: 'Lab 1' }, 2)], [withKey]);
    expect(p.results[0]).toMatchObject({ status: 'update', problems: [] });
    expect(p.writes[0]).toMatchObject({ kind: 'update', sessionId: 's-robotics-am', externalKey: 'ROB-AM' });
    expect(p.counts).toEqual({ create: 0, update: 1, refused: 0 });
  });

  it('a keyed row whose key is new creates the session with that key', () => {
    const p = plan([keyed('NEW-1', {}, 2)]);
    expect(p.writes[0]).toMatchObject({ kind: 'create', externalKey: 'NEW-1' });
  });

  it('refuses an update that would clash with another session in the camp', () => {
    const withKey = { ...SYDNEY_0900_1200, externalKey: 'ROB-AM' };
    const artAm = existing({ id: 's-art', classId: 'cls-art', className: 'Art', startsAt: '2027-07-05T13:00:00+10:00', endsAt: '2027-07-05T15:00:00+10:00' });
    const p = plan([keyed('ROB-AM', { starts_at: '2027-07-05T14:00', ends_at: '2027-07-05T16:00' }, 2)], [withKey, artAm]);
    expect(p.results[0]).toMatchObject({ status: 'refused', problems: [{ field: 'starts_at', message: expect.stringContaining('Clashes with Art') }] });
  });

  it('refuses an update that sets capacity below the campers already enrolled', () => {
    const full = { ...SYDNEY_0900_1200, externalKey: 'ROB-AM', seatsTaken: 2 };
    const p = plan([keyed('ROB-AM', { starts_at: '2027-07-05T09:00', ends_at: '2027-07-05T12:00', location: 'Lab 1', capacity: '1' }, 2)], [full]);
    expect(p.results[0]).toMatchObject({ status: 'refused', problems: [{ field: 'capacity', message: '2 campers are enrolled in this session, so the capacity cannot go below that.' }] });
  });

  it('refuses the second row that uses a key already used earlier in the file', () => {
    const p = plan([keyed('K', {}, 2), keyed('K', { starts_at: '2027-07-06T13:00', ends_at: '2027-07-06T15:00' }, 3)]);
    expect(p.results[1]?.problems[0]).toEqual({ field: 'external_key', message: 'External key "K" is also on row 2. Use each key once.' });
  });

  it('frees the time of a session that this file moves, so another row can take the old time', () => {
    const withKey = { ...SYDNEY_0900_1200, externalKey: 'ROB-AM' };
    const moved = keyed('ROB-AM', { starts_at: '2027-07-05T14:00', ends_at: '2027-07-05T16:00', location: 'Lab 1' }, 2);
    const takesOld = row({ starts_at: '2027-07-05T09:00', ends_at: '2027-07-05T12:00', location: 'Lab 1' }, 3);
    const p = plan([moved, takesOld], [withKey]);
    expect(p.results.map(r => r.status)).toEqual(['update', 'create']);
  });

  it('re-uploading the same file creates nothing new: every keyed row is an update', () => {
    const existingKeyed = [
      existing({ id: 's-1', classId: 'cls-robotics', className: 'Robotics', startsAt: '2027-07-05T03:00:00.000Z', endsAt: '2027-07-05T05:00:00.000Z', location: 'Lab 2', externalKey: 'A' }),
      existing({ id: 's-2', classId: 'cls-art', className: 'Art', startsAt: '2027-07-05T06:00:00.000Z', endsAt: '2027-07-05T08:00:00.000Z', location: 'Studio', externalKey: 'B' }),
    ];
    const rows = [keyed('A', {}, 2), keyed('B', { class_name: 'Art', starts_at: '2027-07-05T16:00', ends_at: '2027-07-05T18:00', location: 'Studio', age_min: '6', age_max: '14', capacity: '10' }, 3)];
    const p = plan(rows, existingKeyed);
    expect(p.counts).toEqual({ create: 0, update: 2, refused: 0 });
    expect(p.writes.map(w => w.sessionId)).toEqual(['s-1', 's-2']);
  });
});

describe('planImport: results', () => {
  it('returns one result per row, in row order, with counts that add up', () => {
    const p = plan([
      row({ capacity: '0' }, 2),
      row({}, 3),
      row({ starts_at: '2027-07-05T13:00', ends_at: '2027-07-05T14:00' }, 4),
    ]);
    expect(p.results.map(r => r.rowNumber)).toEqual([2, 3, 4]);
    expect(p.counts).toEqual({ create: 1, update: 0, refused: 2 });
    expect(p.results.reduce((n, r) => n + (r.status === 'refused' ? 1 : 0), 0)).toBe(p.counts.refused);
  });

  it('keeps the raw cells for display on every row, including refused ones', () => {
    const p = plan([row({ class_name: 'Chess' }, 2)]);
    expect(p.results[0]).toMatchObject({ className: 'Chess', startsAt: '2027-07-05T13:00', endsAt: '2027-07-05T15:00', location: 'Lab 2' });
  });

  it('plans nothing for an empty file', () => {
    expect(plan([])).toEqual({ results: [], writes: [], counts: { create: 0, update: 0, refused: 0 } });
  });

  it('uses every template column name in its problem fields', () => {
    const fields = new Set(IMPORT_COLUMNS as readonly string[]);
    const p = plan([row({ class_name: 'x', starts_at: 'x', ends_at: 'x', age_min: 'x', age_max: 'x', capacity: 'x', ratio_campers: '1', ratio_instructors: 'x' }, 2)]);
    for (const problem of p.results[0]?.problems ?? []) expect(fields.has(problem.field)).toBe(true);
  });
});

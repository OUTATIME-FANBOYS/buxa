import { isValidAgeRange, MAX_AGE_LIMIT, type AgeRange } from '../ageRange';
import { findClash, isValidSpan } from '../interval';
import { formatClash } from '../refusals';
import { parseCampLocal } from './campTime';
import type { ImportColumn } from './columns';
import type { ImportRow } from './file';

/*
 * Plans an import: checks every row against the file, the classes and the sessions already in the camp, and says what each row would
 * do. Pure: it reads nothing and writes nothing. The service runs it for the preview and again, on current data, for the confirm.
 *
 * Rules are the manual-entry rules: a session must end after it starts, touching sessions do not clash, sessions that cross midnight
 * are compared as instants, and the age range is the class's. An import never bypasses them, and it never creates a class.
 * A row is checked against the rows accepted before it, in file order, so the later row of a clash is the one refused.
 */

export const MAX_CAPACITY = 500;
const MAX_LOCATION = 200;
const MAX_KEY = 100;
const MAX_INSTRUCTORS = 50;

export interface ClassRef { id: string; name: string; ageRange: AgeRange; capacity: number }

/** A session already in the camp, with its times as ISO instants (any offset). */
export interface ExistingSession {
  id: string;
  classId: string;
  className: string;
  startsAt: string;
  endsAt: string;
  location: string;
  capacity: number;
  seatsTaken: number;
  externalKey: string | null;
}

export interface PlanInput { rows: ImportRow[]; classes: ClassRef[]; sessions: ExistingSession[]; timeZone: string }

export type RowStatus = 'create' | 'update' | 'refused';
export interface RowProblem { field: ImportColumn; message: string }

export interface RowResult {
  rowNumber: number;
  status: RowStatus;
  externalKey: string | null;
  /** The cells as the owner wrote them, so a refused row can be shown and fixed. */
  className: string;
  startsAt: string;
  endsAt: string;
  location: string;
  problems: RowProblem[];
}

/** What a ready row writes. Instants are UTC ISO strings. Instructor names and ratios are carried for later; see the PR notes. */
export interface PlannedWrite {
  rowNumber: number;
  kind: 'create' | 'update';
  sessionId: string | null;
  classId: string;
  startsAt: string;
  endsAt: string;
  location: string;
  capacity: number;
  externalKey: string | null;
  instructorNames: string[];
  ratio: { instructors: number; campers: number } | null;
}

export interface ImportPlan {
  results: RowResult[];
  writes: PlannedWrite[];
  counts: { create: number; update: number; refused: number };
}

const WHOLE = /^\d+$/;
const wholeNumber = (text: string): number | null => (WHOLE.test(text) ? Number(text) : null);
const sameText = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();
const problem = (field: ImportColumn, message: string): RowProblem => ({ field, message });

interface Checked {
  problems: RowProblem[];
  parsed: null | {
    cls: ClassRef; startsAt: string; endsAt: string; location: string; capacity: number; key: string | null;
    instructorNames: string[]; ratio: { instructors: number; campers: number } | null;
  };
}

/** The row's own fields: each problem names its column. Nothing here looks at other rows or at the camp's sessions. */
function checkFields(row: ImportRow, classes: ClassRef[], timeZone: string): Checked {
  const c = row.cells;
  const problems: RowProblem[] = [];

  let cls: ClassRef | undefined;
  if (c.class_name === '') {
    problems.push(problem('class_name', 'Give the class name.'));
  } else {
    const matches = classes.filter(x => sameText(x.name, c.class_name));
    if (matches.length === 0) problems.push(problem('class_name', `There is no class called "${c.class_name}". Create the class first: an import does not create classes.`));
    else if (matches.length > 1) problems.push(problem('class_name', `More than one class is called "${c.class_name}". Rename one of them first.`));
    else cls = matches[0];
  }

  const start = parseCampLocal(c.starts_at, timeZone);
  const end = parseCampLocal(c.ends_at, timeZone);
  if (!start.ok) problems.push(problem('starts_at', start.message));
  if (!end.ok) problems.push(problem('ends_at', end.message));
  if (start.ok && end.ok && !isValidSpan({ startsAt: start.instant, endsAt: end.instant })) {
    problems.push(problem('ends_at', 'The session must end after it starts.'));
  }

  if (c.location === '') problems.push(problem('location', 'Give the location.'));
  else if (c.location.length > MAX_LOCATION) problems.push(problem('location', `Keep the location under ${MAX_LOCATION} characters.`));

  const minAge = wholeNumber(c.age_min);
  const maxAge = wholeNumber(c.age_max);
  if (minAge === null) problems.push(problem('age_min', 'Enter the youngest age as a whole number.'));
  if (maxAge === null) problems.push(problem('age_max', 'Enter the oldest age as a whole number.'));
  if (minAge !== null && maxAge !== null) {
    if (!isValidAgeRange({ minAge, maxAge })) {
      const outOfBounds = minAge > MAX_AGE_LIMIT || maxAge > MAX_AGE_LIMIT;
      problems.push(problem('age_max', outOfBounds ? `Ages must be between 0 and ${MAX_AGE_LIMIT}.` : 'The youngest age cannot be above the oldest.'));
    } else if (cls && (cls.ageRange.minAge !== minAge || cls.ageRange.maxAge !== maxAge)) {
      problems.push(problem('age_min', `${cls.name} is for ages ${cls.ageRange.minAge} to ${cls.ageRange.maxAge}. Use those ages.`));
    }
  }

  const capacity = wholeNumber(c.capacity);
  if (capacity === null || capacity < 1 || capacity > MAX_CAPACITY) {
    problems.push(problem('capacity', `Capacity is a whole number of places, from 1 to ${MAX_CAPACITY}.`));
  }

  const instructorNames = c.instructor_names === '' ? [] : c.instructor_names.split(';').map(n => n.trim());
  if (instructorNames.some(n => n === '')) {
    problems.push(problem('instructor_names', 'Each instructor needs a name between the semicolons. Remove the empty one.'));
  }

  let ratio: { instructors: number; campers: number } | null = null;
  const bothEmpty = c.ratio_campers === '' && c.ratio_instructors === '';
  const oneEmpty = c.ratio_campers === '' || c.ratio_instructors === '';
  if (oneEmpty && !bothEmpty) {
    const field = c.ratio_campers === '' ? 'ratio_campers' : 'ratio_instructors';
    problems.push(problem(field, 'Give both ratio columns, or leave both empty.'));
  } else if (!bothEmpty) {
    const campers = wholeNumber(c.ratio_campers);
    const instructors = wholeNumber(c.ratio_instructors);
    const campersOk = campers !== null && campers >= 1 && campers <= MAX_CAPACITY;
    const instructorsOk = instructors !== null && instructors >= 1 && instructors <= MAX_INSTRUCTORS;
    if (!campersOk) problems.push(problem('ratio_campers', 'The ratio is a positive whole number of campers.'));
    if (!instructorsOk) problems.push(problem('ratio_instructors', 'The ratio is a positive whole number of instructors.'));
    if (campersOk && instructorsOk) ratio = { campers, instructors };
  }

  if (c.external_key.length > MAX_KEY) problems.push(problem('external_key', `Keep the external key under ${MAX_KEY} characters.`));

  if (problems.length > 0 || !cls || !start.ok || !end.ok || capacity === null) return { problems, parsed: null };
  return {
    problems,
    parsed: {
      cls, startsAt: start.instant, endsAt: end.instant, location: c.location, capacity,
      key: c.external_key === '' ? null : c.external_key, instructorNames, ratio,
    },
  };
}

interface Accepted { rowNumber: number; classId: string; className: string; location: string; startsAt: string; endsAt: string }

export function planImport({ rows, classes, sessions, timeZone }: PlanInput): ImportPlan {
  const results: RowResult[] = [];
  const writes: PlannedWrite[] = [];
  const accepted: Accepted[] = [];
  /** Existing sessions this file updates. They no longer hold their old times, so other rows may take them. */
  const claimed = new Set<string>();
  const keyRows = new Map<string, number>();

  const refuse = (row: ImportRow, problems: RowProblem[]): void => {
    results.push({
      rowNumber: row.rowNumber, status: 'refused', externalKey: row.cells.external_key === '' ? null : row.cells.external_key,
      className: row.cells.class_name, startsAt: row.cells.starts_at, endsAt: row.cells.ends_at, location: row.cells.location, problems,
    });
  };

  for (const row of rows) {
    const { problems, parsed } = checkFields(row, classes, timeZone);
    if (!parsed) { refuse(row, problems); continue; }
    const { cls, startsAt, endsAt, location, capacity, key, instructorNames, ratio } = parsed;

    if (key !== null && keyRows.has(key)) {
      refuse(row, [problem('external_key', `External key "${key}" is also on row ${keyRows.get(key)}. Use each key once.`)]);
      continue;
    }
    const target = key === null ? undefined : sessions.find(s => s.externalKey === key);
    const others = sessions.filter(s => !claimed.has(s.id) && s.id !== target?.id);
    const span = { startsAt, endsAt };

    const fileProblem = ((): RowProblem | null => {
      if (!target) {
        const same = (s: { classId: string; startsAt: string; endsAt: string; location: string }): boolean =>
          s.classId === cls.id && Date.parse(s.startsAt) === Date.parse(startsAt) && Date.parse(s.endsAt) === Date.parse(endsAt)
          && sameText(s.location, location);
        const existing = others.find(same);
        if (existing) {
          return problem('starts_at', `This session is already in the camp (${existing.className}, ${formatClash(existing, timeZone)}). Nothing to add.`);
        }
        const earlier = accepted.find(same);
        if (earlier) return problem('starts_at', `The same session is on row ${earlier.rowNumber} of this file.`);
      } else if (target.seatsTaken > capacity) {
        return problem('capacity', `${target.seatsTaken} campers are enrolled in this session, so the capacity cannot go below that.`);
      }
      const clashing = findClash(span, others);
      if (clashing) {
        return problem('starts_at', `Clashes with ${clashing.className}, ${formatClash(clashing, timeZone)}, which is already in the camp. Choose other times, or change that session.`);
      }
      const clashRow = findClash(span, accepted);
      if (clashRow) {
        return problem('starts_at', `Clashes with row ${clashRow.rowNumber} of this file (${clashRow.className}, ${formatClash(clashRow, timeZone)}).`);
      }
      return null;
    })();

    if (fileProblem) { refuse(row, [fileProblem]); continue; }

    const status: RowStatus = target ? 'update' : 'create';
    writes.push({
      rowNumber: row.rowNumber, kind: status === 'update' ? 'update' : 'create', sessionId: target?.id ?? null, classId: cls.id,
      startsAt, endsAt, location, capacity, externalKey: key, instructorNames, ratio,
    });
    accepted.push({ rowNumber: row.rowNumber, classId: cls.id, className: cls.name, location, startsAt, endsAt });
    if (target) claimed.add(target.id);
    if (key !== null) keyRows.set(key, row.rowNumber);
    results.push({
      rowNumber: row.rowNumber, status, externalKey: key, className: cls.name, startsAt: row.cells.starts_at,
      endsAt: row.cells.ends_at, location, problems: [],
    });
  }

  const counts = { create: 0, update: 0, refused: 0 };
  for (const r of results) counts[r.status] += 1;
  return { results, writes, counts };
}

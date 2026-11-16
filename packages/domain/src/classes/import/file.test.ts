import { describe, expect, it } from 'vitest';
import { IMPORT_COLUMNS } from './columns';
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, readImportFile } from './file';

const HEADER = IMPORT_COLUMNS.join(',');
const ROW = 'EXT-1,Robotics,2027-07-05T09:00,2027-07-05T12:00,Lab 1,8,12,2,Ana;Ben,1,8';

const read = (text: string) => readImportFile(text);

describe('readImportFile: header', () => {
  it('accepts the template header and maps each data row by column name', () => {
    const r = read(`${HEADER}\r\n${ROW}\r\n`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toEqual([{
      rowNumber: 2,
      cells: {
        external_key: 'EXT-1', class_name: 'Robotics', starts_at: '2027-07-05T09:00', ends_at: '2027-07-05T12:00', location: 'Lab 1',
        age_min: '8', age_max: '12', capacity: '2', instructor_names: 'Ana;Ben', ratio_campers: '1', ratio_instructors: '8',
      },
    }]);
  });

  it('accepts the columns in any order, matched by name', () => {
    const reversed = [...IMPORT_COLUMNS].reverse().join(',');
    const values = [...IMPORT_COLUMNS].reverse().map(c => (c === 'class_name' ? 'Art' : ''));
    const r = read(`${reversed}\n${values.join(',')}\n`);
    expect(r.ok && r.rows[0]?.cells.class_name).toBe('Art');
  });

  it('names the exact column that is missing', () => {
    const without = IMPORT_COLUMNS.filter(c => c !== 'ends_at').join(',');
    expect(read(`${without}\n`)).toEqual({ ok: false, message: 'The column "ends_at" is missing from the header row.' });
  });

  it('names a misspelled column as missing, and the misspelt one as not part of the template', () => {
    const misspelt = HEADER.replace('starts_at', 'start_at');
    const r = read(`${misspelt}\n`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toBe('The column "starts_at" is missing from the header row.');
  });

  it('names an unknown extra column', () => {
    expect(read(`${HEADER},notes\n`)).toEqual({ ok: false, message: 'The column "notes" is not part of the template. Check the spelling.' });
  });

  it('names a column that appears twice', () => {
    expect(read(`${HEADER},location\n`)).toEqual({ ok: false, message: 'The column "location" appears more than once.' });
  });

  it('refuses an empty file', () => {
    expect(read('﻿\r\n\r\n')).toEqual({ ok: false, message: 'The file is empty. Download the template and fill it in.' });
  });
});

describe('readImportFile: rows and limits', () => {
  it('ignores empty lines between data rows, keeping the spreadsheet row numbers', () => {
    const r = read(`${HEADER}\n${ROW}\n\n\n${ROW}\n`);
    expect(r.ok && r.rows.map(x => x.rowNumber)).toEqual([2, 5]);
  });

  it('pads a short row with empty cells', () => {
    const r = read(`${HEADER}\nEXT-1,Robotics\n`);
    expect(r.ok && r.rows[0]?.cells.location).toBe('');
  });

  it('refuses a row with a value beyond the last column', () => {
    expect(read(`${HEADER}\n${ROW},extra\n`)).toEqual({ ok: false, message: 'Row 2 has more cells than the header row.' });
  });

  it('accepts a file with the row limit and refuses one row more', () => {
    const rows = (n: number) => Array.from({ length: n }, () => ROW).join('\n');
    expect(read(`${HEADER}\n${rows(MAX_IMPORT_ROWS)}\n`).ok).toBe(true);
    expect(read(`${HEADER}\n${rows(MAX_IMPORT_ROWS + 1)}\n`)).toEqual({
      ok: false,
      message: `That file has ${MAX_IMPORT_ROWS + 1} rows. Import at most ${MAX_IMPORT_ROWS} at a time.`,
    });
  });

  it('refuses a file over 1 MB before parsing it', () => {
    const big = `${HEADER}\n${'x'.repeat(MAX_IMPORT_BYTES)}`;
    expect(read(big)).toEqual({ ok: false, message: 'That file is larger than 1 MB. Split it into smaller files.' });
  });

  it('measures the size in UTF-8 bytes, not characters', () => {
    // 2 bytes per character: a string of half the byte limit in characters can still be over it.
    const accented = `${HEADER}\n${'é'.repeat(Math.floor(MAX_IMPORT_BYTES / 2) + 1)}`;
    expect(read(accented).ok).toBe(false);
  });

  it('reports a parse error with its line', () => {
    expect(read(`${HEADER}\n"${ROW}\n`)).toEqual({ ok: false, message: 'Line 2: A quote opened on line 2 is never closed.' });
  });
});

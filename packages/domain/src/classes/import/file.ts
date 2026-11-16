import { IMPORT_COLUMNS, type ImportColumn } from './columns';
import { parseCsvRecords } from './csv';

/** Largest file an import accepts, in UTF-8 bytes. */
export const MAX_IMPORT_BYTES = 1024 * 1024;
/** Most data rows one file may hold. The same kind of cap as the attendance export's MAX_LOG_ROWS. */
export const MAX_IMPORT_ROWS = 1000;

/** One data row: its spreadsheet row number (the header is row 1) and its cells by column name. */
export interface ImportRow { rowNumber: number; cells: Record<ImportColumn, string> }

export type ImportFile = { ok: true; rows: ImportRow[] } | { ok: false; message: string };

const EMPTY_CELLS = (): Record<ImportColumn, string> => Object.fromEntries(IMPORT_COLUMNS.map(c => [c, ''])) as Record<ImportColumn, string>;

/**
 * Checks an uploaded file's shape and returns its rows keyed by column name. Refusals name the column or row at fault, in plain words.
 * The header must contain every template column (in any order); a missing or misspelt column is refused by name.
 */
export function readImportFile(text: string): ImportFile {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    return { ok: false, message: 'That file is larger than 1 MB. Split it into smaller files.' };
  }
  const parsed = parseCsvRecords(text);
  if (!parsed.ok) return { ok: false, message: `Line ${parsed.line}: ${parsed.message}` };
  const [header, ...data] = parsed.records;
  if (!header) return { ok: false, message: 'The file is empty. Download the template and fill it in.' };

  const names = header.cells.map(c => c.trim());
  const known = new Set<string>(IMPORT_COLUMNS);
  for (const column of IMPORT_COLUMNS) {
    if (!names.includes(column)) return { ok: false, message: `The column "${column}" is missing from the header row.` };
  }
  for (const name of names) {
    if (name === '') continue;
    if (!known.has(name)) return { ok: false, message: `The column "${name}" is not part of the template. Check the spelling.` };
  }
  const dup = names.find((n, i) => n !== '' && names.indexOf(n) !== i);
  if (dup !== undefined) return { ok: false, message: `The column "${dup}" appears more than once.` };
  if (data.length > MAX_IMPORT_ROWS) {
    return { ok: false, message: `That file has ${data.length} rows. Import at most ${MAX_IMPORT_ROWS} at a time.` };
  }

  const rows: ImportRow[] = [];
  for (const record of data) {
    if (record.cells.length > names.length && record.cells.slice(names.length).some(c => c.trim() !== '')) {
      return { ok: false, message: `Row ${record.line} has more cells than the header row.` };
    }
    const cells = EMPTY_CELLS();
    names.forEach((name, i) => {
      if (known.has(name)) cells[name as ImportColumn] = (record.cells[i] ?? '').trim();
    });
    rows.push({ rowNumber: record.line, cells });
  }
  return { ok: true, rows };
}

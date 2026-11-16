/**
 * CSV for exports: RFC 4180 quoting plus spreadsheet formula neutralisation. The attendance service builds its export with
 * `encodeCsv`, so every CSV the camp hands out goes through this one rule.
 *
 * - Rows end with CRLF (RFC 4180). No rows encode to the empty string.
 * - A cell containing a comma, a double quote, CR or LF is wrapped in double quotes, with inner quotes doubled.
 * - A text cell starting with `=`, `+`, `-`, `@`, a tab or a CR gets a leading apostrophe, so Excel and Sheets show it as text
 *   rather than running it as a formula (CSV injection). Numbers are written as they are: they cannot start a formula.
 * - `null` and `undefined` become an empty cell.
 */
export type CsvCell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

/** A text value with the apostrophe prefix when a spreadsheet would read it as a formula. */
export function neutraliseFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

/** One cell, encoded: formula-neutralised first, then quoted if RFC 4180 requires it. */
export function csvCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return '';
  const text = typeof cell === 'number' ? String(cell) : neutraliseFormula(cell);
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Rows of cells as CSV text, CRLF-terminated. */
export function encodeCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map(row => `${row.map(csvCell).join(',')}\r\n`).join('');
}

/**
 * Reads CSV text into records (RFC 4180 reading): quoted fields, commas and line breaks inside quotes, doubled quotes, LF or CRLF,
 * a UTF-8 byte-order mark, and blank lines skipped. Each record keeps the line it starts on, so a row can be named to the owner
 * by the row number they see in their spreadsheet. Writing CSV is the web app's `encodeCsv`; this only reads.
 */
export interface CsvRecord { line: number; cells: string[] }
export type CsvParse = { ok: true; records: CsvRecord[] } | { ok: false; line: number; message: string };

const BOM = '﻿';

export function parseCsvRecords(input: string): CsvParse {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let quotedLine = 0;
  let recordLine = 1;
  let line = 1;
  let quotedThisRecord = false;

  const endRecord = (): void => {
    cells.push(field);
    const blank = cells.length === 1 && cells[0]?.trim() === '' && !quotedThisRecord;
    if (!blank) {
      records.push({ line: recordLine, cells });
    }
    cells = [];
    field = '';
    quotedThisRecord = false;
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'; i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (c === '\n') {
          line++;
        }
        field += c;
      }
      continue;
    }
    if (c === '"' && field === '') {
      inQuotes = true;
      quotedThisRecord = true;
      quotedLine = line;
    } else if (c === ',') {
      cells.push(field);
      field = '';
    } else if (c === '\r' && text[i + 1] === '\n') {
      // The LF that follows ends the record.
    } else if (c === '\n' || c === '\r') {
      endRecord();
      line++;
      recordLine = line;
    } else {
      field += c;
    }
  }

  if (inQuotes) {
    return { ok: false, line: quotedLine, message: `A quote opened on line ${quotedLine} is never closed.` };
  }
  if (cells.length > 0 || field !== '') {
    endRecord();
  }

  return { ok: true, records };
}

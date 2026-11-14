import { describe, expect, it } from 'vitest';
import { csvCell, encodeCsv, neutraliseFormula } from './csv';

describe('neutraliseFormula', () => {
  it.each(['=SUM(A1)', '+1+1', '-2+3', '@cmd', '\tcalc', '\rcalc'])('prefixes an apostrophe to %j', value => {
    expect(neutraliseFormula(value)).toBe(`'${value}`);
  });

  it.each(['Ada', "O'Brien", 'a=b', 'Mr - Chen', ''])('leaves ordinary text alone: %j', value => {
    expect(neutraliseFormula(value)).toBe(value);
  });
});

describe('csvCell', () => {
  it('writes plain text unquoted', () => expect(csvCell('Ada Lovelace')).toBe('Ada Lovelace'));

  it.each([
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['line\nbreak', '"line\nbreak"'],
    ['cr\rhere', '"cr\rhere"'],
  ])('quotes %j when RFC 4180 requires it', (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it('neutralises a formula and then quotes it when needed', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });

  it('writes empty for null and undefined, and numbers as they are', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell(0)).toBe('0');
  });
});

describe('encodeCsv', () => {
  it('ends every row with CRLF', () => {
    expect(encodeCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d\r\n');
  });

  it('encodes no rows as the empty string', () => {
    expect(encodeCsv([])).toBe('');
  });

  it('keeps an empty cell in place', () => {
    expect(encodeCsv([['a', null, '', 'c']])).toBe('a,,,c\r\n');
  });

  it('round-trips a tricky record through a minimal RFC 4180 reader', () => {
    const text = encodeCsv([['name', 'note'], ['Ada, "the first"', 'multi\nline'], ['@admin', '']]);
    expect(parseCsv(text)).toEqual([['name', 'note'], ['Ada, "the first"', 'multi\nline'], ["'@admin", '']]);
  });
});

/** A small RFC 4180 reader, used only by the round-trip test. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch === '"' && text.charAt(i + 1) === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\r' && text.charAt(i + 1) === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i += 1; }
    else cell += ch;
  }
  return rows;
}

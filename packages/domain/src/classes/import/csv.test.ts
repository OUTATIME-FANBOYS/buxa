import { describe, expect, it } from 'vitest';
import { parseCsvRecords } from './csv';

const cells = (text: string) => {
  const r = parseCsvRecords(text);
  if (!r.ok) throw new Error(r.message);
  return r.records.map(x => x.cells);
};

describe('parseCsvRecords', () => {
  it('parses plain LF and CRLF rows', () => {
    expect(cells('a,b,c\nd,e,f\n')).toEqual([['a', 'b', 'c'], ['d', 'e', 'f']]);
    expect(cells('a,b,c\r\nd,e,f\r\n')).toEqual([['a', 'b', 'c'], ['d', 'e', 'f']]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(cells('name,location\r\n"Robotics, junior","Lab 1, east"\r\n')).toEqual([['name', 'location'], ['Robotics, junior', 'Lab 1, east']]);
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    expect(cells('a\r\n"say ""hi"""\r\n')).toEqual([['a'], ['say "hi"']]);
  });

  it('keeps a line break inside a quoted field', () => {
    expect(cells('a,b\r\n"line one\nline two",x\r\n')).toEqual([['a', 'b'], ['line one\nline two', 'x']]);
  });

  it('strips a UTF-8 byte-order mark before the first header', () => {
    expect(cells('﻿external_key,class_name\r\nk1,Robotics\r\n')).toEqual([['external_key', 'class_name'], ['k1', 'Robotics']]);
  });

  it('ignores empty lines and reports the physical line of each record', () => {
    const r = parseCsvRecords('a,b\n\n\nc,d\n\n');
    if (!r.ok) throw new Error(r.message);
    expect(r.records).toEqual([{ line: 1, cells: ['a', 'b'] }, { line: 4, cells: ['c', 'd'] }]);
  });

  it('keeps empty cells', () => {
    expect(cells('a,,c\n,,\n')).toEqual([['a', '', 'c'], ['', '', '']]);
  });

  it('reports an unclosed quote with the line where it started', () => {
    expect(parseCsvRecords('a,b\n"open,c\nd,e\n')).toEqual({ ok: false, line: 2, message: 'A quote opened on line 2 is never closed.' });
  });

  it('reads a last row without a trailing newline', () => {
    expect(cells('a,b\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

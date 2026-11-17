import { describe, expect, it } from 'vitest';
import { IMPORT_COLUMNS, readImportFile, type RowResult } from '@buxa/domain';
import { encodeCsv } from '@/logic/common';
import { importErrorReportCsv, importTemplateCsv } from './importCsv';

describe('importTemplateCsv', () => {
  it('is the header row of the eleven template columns, in order, CRLF-terminated', () => {
    expect(importTemplateCsv()).toBe(`${IMPORT_COLUMNS.join(',')}\r\n`);
  });

  it('is a file the import itself reads back with no rows and no errors', () => {
    expect(readImportFile(importTemplateCsv())).toEqual({ ok: true, rows: [] });
  });
});

const refused = (over: Partial<RowResult>): RowResult => ({
  rowNumber: 2, status: 'refused', externalKey: null, className: 'Robotics', startsAt: '2027-07-05T09:00', endsAt: '2027-07-05T12:00',
  location: 'Lab 1', problems: [], ...over,
});

describe('importErrorReportCsv', () => {
  it('lists one line per problem, naming the row and the field, under a header', () => {
    const csv = importErrorReportCsv([
      refused({ rowNumber: 3, problems: [{ field: 'capacity', message: 'Capacity is a whole number of places, from 1 to 500.' }] }),
      refused({ rowNumber: 4, className: 'Chess', problems: [
        { field: 'class_name', message: 'There is no class called "Chess".' },
        { field: 'location', message: 'Give the location.' },
      ] }),
    ]);
    expect(csv).toBe([
      'row,field,message,class_name,starts_at,ends_at,location',
      '3,capacity,"Capacity is a whole number of places, from 1 to 500.",Robotics,2027-07-05T09:00,2027-07-05T12:00,Lab 1',
      '4,class_name,"There is no class called ""Chess"".",Chess,2027-07-05T09:00,2027-07-05T12:00,Lab 1',
      '4,location,Give the location.,Chess,2027-07-05T09:00,2027-07-05T12:00,Lab 1',
      '',
    ].join('\r\n'));
  });

  it('leaves out rows that are ready', () => {
    const csv = importErrorReportCsv([{ ...refused({}), status: 'create' }]);
    expect(csv).toBe('row,field,message,class_name,starts_at,ends_at,location\r\n');
  });

  it('neutralises a spreadsheet formula typed into a cell (CSV injection)', () => {
    const csv = importErrorReportCsv([refused({ className: '=HYPERLINK("x")', problems: [{ field: 'class_name', message: '@cmd' }] })]);
    const dataLine = csv.split('\r\n')[1] ?? '';
    expect(dataLine).toContain('\'=HYPERLINK(""x"")');
    expect(dataLine).toContain('\'@cmd');
  });

  it('uses the shared encoder (the same quoting as the attendance export)', () => {
    const csv = importErrorReportCsv([refused({ problems: [{ field: 'location', message: 'a, "b"' }] })]);
    expect(csv).toBe(encodeCsv([
      ['row', 'field', 'message', 'class_name', 'starts_at', 'ends_at', 'location'],
      [2, 'location', 'a, "b"', 'Robotics', '2027-07-05T09:00', '2027-07-05T12:00', 'Lab 1'],
    ]));
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_ATTENDANCE_FIELDS } from '@buxa/contracts';
import { ROUTES } from '../../config/routes';
import { attendanceExportPath, attendanceFileName } from '../paths';

const filter = { from: '2027-07-01', to: '2027-07-03' } as const;
const defaults = DEFAULT_ATTENDANCE_FIELDS.join(',');

describe('attendance paths', () => {
  it('builds the export address from ROUTES with the date range and the columns', () => {
    expect(attendanceExportPath(filter as never)).toBe(
      `${ROUTES.attendance}/export?from=2027-07-01&to=2027-07-03&fields=${encodeURIComponent(defaults)}`,
    );
  });
  it('adds personId only when the filter has one', () => {
    expect(attendanceExportPath({ ...filter, personId: 'p1' }, ['person'])).toContain('&personId=p1');
    expect(attendanceExportPath(filter as never, ['person'])).not.toContain('personId');
  });
  it('carries every other filter part, and only the ones that are set', () => {
    const address = attendanceExportPath(
      { ...filter, sessionId: 's1', classId: 'c1', method: 'manual', checkedInBy: 'u1', status: 'checked_out' },
      ['person', 'method'],
    );
    expect(address).toBe(
      `${ROUTES.attendance}/export?from=2027-07-01&to=2027-07-03&sessionId=s1&classId=c1&method=manual&checkedInBy=u1&status=checked_out&fields=person%2Cmethod`,
    );
    expect(attendanceExportPath(filter as never, ['person'])).not.toContain('status');
  });
  it('names the file after the date range', () => {
    expect(attendanceFileName(filter as never)).toBe('attendance-2027-07-01-to-2027-07-03.csv');
  });
});

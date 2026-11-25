import { describe, expect, it } from 'vitest';
import { ROUTES } from '../../config/routes';
import { attendanceExportPath, attendanceFileName } from '../paths';

const filter = { from: '2027-07-01', to: '2027-07-03' } as const;

describe('attendance paths', () => {
  it('builds the export address from ROUTES with the date range', () => {
    expect(attendanceExportPath(filter as never)).toBe(`${ROUTES.attendance}/export?from=2027-07-01&to=2027-07-03`);
  });
  it('adds personId only when the filter has one', () => {
    expect(attendanceExportPath({ ...filter, personId: 'p1' })).toContain('&personId=p1');
  });
  it('carries every other filter part, and only the ones that are set', () => {
    const address = attendanceExportPath({
      ...filter,
      sessionId: 's1',
      classId: 'c1',
      method: 'manual',
      checkedInBy: 'u1',
      status: 'checked_out',
    });
    expect(address).toBe(
      `${ROUTES.attendance}/export?from=2027-07-01&to=2027-07-03&sessionId=s1&classId=c1&method=manual&checkedInBy=u1&status=checked_out`,
    );
    expect(attendanceExportPath(filter as never)).not.toContain('status');
  });
  it('names the file after the date range', () => {
    expect(attendanceFileName(filter as never)).toBe('attendance-2027-07-01-to-2027-07-03.csv');
  });
});

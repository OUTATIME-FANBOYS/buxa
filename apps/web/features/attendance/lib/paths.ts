import type { AttendanceFilter } from '@buxa/contracts';
import { ROUTES } from '@/config/routes';

/** The CSV export address for a filter, built from ROUTES so the address is defined once. */
export const attendanceExportPath = (filter: AttendanceFilter): string => {
  const query = new URLSearchParams({ from: filter.from, to: filter.to });
  if (filter.personId) query.set('personId', filter.personId);
  return `${ROUTES.attendance}/export?${query.toString()}`;
};

/** The download's file name. The dates passed the filter schema, so the name is safe to put in a header. */
export const attendanceFileName = (filter: AttendanceFilter): string => `attendance-${filter.from}-to-${filter.to}.csv`;

import type { AttendanceFilter } from '@buxa/contracts';
import { ROUTES } from '../config/routes';

/** The filter's optional parts, by their URL names. Only the ones that are set are written. */
const optionalParts = (filter: AttendanceFilter): [string, string | undefined][] => [
  ['personId', filter.personId],
  ['sessionId', filter.sessionId],
  ['classId', filter.classId],
  ['method', filter.method],
  ['checkedInBy', filter.checkedInBy],
  ['status', filter.status],
];

/** The CSV export address for a filter, built from ROUTES so the address is defined once. */
export const attendanceExportPath = (filter: AttendanceFilter): string => {
  const query = new URLSearchParams({ from: filter.from, to: filter.to });
  for (const [name, value] of optionalParts(filter)) {
    if (value) {
      query.set(name, value);
    }
  }

  return `${ROUTES.attendance}/export?${query.toString()}`;
};

/** The download's file name. The dates passed the filter schema, so the name is safe to put in a header. */
export const attendanceFileName = (filter: AttendanceFilter): string => `attendance-${filter.from}-to-${filter.to}.csv`;

import type { AttendanceEntry, AttendanceField } from '@buxa/contracts';
import type { ClockFormat } from '@buxa/domain';
import { formatCampDateTime } from '../time';
import { METHOD_LABEL } from './labels';

/** The camp's zone and the signed-in person's clock: the same display for the table and the CSV. */
export interface FieldDisplay {
  timeZone: string;
  clockFormat: ClockFormat;
}

/**
 * What one field shows for one visit: its text, or null when there is nothing to show (the table draws a dash, the CSV an empty
 * cell). Times are camp time. An open visit reads "On site" in the Out column.
 */
export function attendanceFieldValue(
  entry: AttendanceEntry,
  field: AttendanceField,
  display: FieldDisplay,
): string | null {
  switch (field) {
    case 'person':
      return entry.personName;
    case 'session':
      return entry.sessionName;
    case 'class':
      return entry.className;
    case 'in':
      return formatCampDateTime(entry.checkedInAt, display.timeZone, display.clockFormat);
    case 'out':
      return entry.checkedOutAt === null
        ? 'On site'
        : formatCampDateTime(entry.checkedOutAt, display.timeZone, display.clockFormat);
    case 'checkedInBy':
      return entry.checkedInByName;
    case 'checkedOutBy':
      return entry.checkedOutByName;
    case 'collectedBy':
      return entry.collectedByName;
    case 'method':
      return METHOD_LABEL[entry.method];
    case 'overrideReason':
      return entry.overrideReason;
  }
}

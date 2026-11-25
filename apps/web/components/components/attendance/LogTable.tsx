import type { AttendanceEntry, AttendanceField } from '@buxa/contracts';
import { ATTENDANCE_FIELD_IDS, ATTENDANCE_FIELD_LABELS } from '@buxa/contracts';
import { attendanceFieldValue } from '@buxa/shared';
import type { ClockFormat } from '@buxa/domain';

interface Props {
  entries: readonly AttendanceEntry[];
  timeZone: string;
  clockFormat: ClockFormat;
  /** The columns to show, in table order. Defaults to every column. */
  fields?: readonly AttendanceField[];
}

/** The times are the only columns that read as numbers. */
const NUMERIC: ReadonlySet<AttendanceField> = new Set(['in', 'out']);

/**
 * The attendance log: one row per visit, times in camp time, staff by name. Newest first, as the service returns them. The columns
 * and their cell text come from the shared field list, the same one the CSV uses. An empty cell is a muted dash.
 */
export function LogTable({ entries, timeZone, clockFormat, fields = ATTENDANCE_FIELD_IDS }: Props) {
  const display = { timeZone, clockFormat };

  return (
    <div className="table-wrap">
      <table className="table log-table">
        <caption className="sr-only">Check-ins and check-outs for the chosen days</caption>
        <thead>
          <tr>
            {fields.map(field => (
              <th key={field} scope="col">
                {ATTENDANCE_FIELD_LABELS[field]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.id}>
              {fields.map(field => {
                const value = attendanceFieldValue(entry, field, display);
                const cell = value ?? <span className="muted">—</span>;

                return field === 'person' ? (
                  <th key={field} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td
                    key={field}
                    className={NUMERIC.has(field) ? 'num' : undefined}
                    data-label={ATTENDANCE_FIELD_LABELS[field]}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import type { AttendanceEntry } from '@buxa/contracts';
import { METHOD_LABEL } from '@buxa/shared';
import { formatCampDateTime } from '@buxa/shared';
import type { ClockFormat } from '@buxa/domain';

interface Props {
  entries: readonly AttendanceEntry[];
  timeZone: string;
  clockFormat: ClockFormat;
}

const dash = (value: string | null) => value ?? '—';

/** The attendance log: one row per visit, times in camp time, staff by name. Newest first, as the service returns them. */
export function LogTable({ entries, timeZone, clockFormat }: Props) {
  return (
    <div className="table-wrap">
      <table className="table log-table">
        <caption className="sr-only">Check-ins and check-outs for the chosen days</caption>
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">In</th>
            <th scope="col">Out</th>
            <th scope="col">Checked in by</th>
            <th scope="col">Checked out by</th>
            <th scope="col">Collected by</th>
            <th scope="col">Method</th>
            <th scope="col">Override reason</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.id}>
              <th scope="row">{entry.personName}</th>
              <td className="num" data-label="In">
                {formatCampDateTime(entry.checkedInAt, timeZone, clockFormat)}
              </td>
              <td className="num" data-label="Out">
                {entry.checkedOutAt ? formatCampDateTime(entry.checkedOutAt, timeZone, clockFormat) : 'On site'}
              </td>
              <td data-label="Checked in by">{dash(entry.checkedInByName)}</td>
              <td data-label="Checked out by">{dash(entry.checkedOutByName)}</td>
              <td data-label="Collected by">{dash(entry.collectedByName)}</td>
              <td data-label="Method">{METHOD_LABEL[entry.method]}</td>
              <td data-label="Override reason">{dash(entry.overrideReason)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

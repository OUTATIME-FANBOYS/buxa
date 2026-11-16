import type { AttendanceEntry } from '@buxa/contracts';
import { METHOD_LABEL } from '../lib/labels';
import { formatCampDateTime } from '../lib/time';

interface Props { entries: readonly AttendanceEntry[]; timeZone: string }

const dash = (value: string | null) => value ?? '—';

/** The attendance log: one row per visit, times in camp time, staff by name. Newest first, as the service returns them. */
export function LogTable({ entries, timeZone }: Props) {
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
              <td className="num">{formatCampDateTime(entry.checkedInAt, timeZone)}</td>
              <td className="num">{entry.checkedOutAt ? formatCampDateTime(entry.checkedOutAt, timeZone) : 'On site'}</td>
              <td>{dash(entry.checkedInByName)}</td>
              <td>{dash(entry.checkedOutByName)}</td>
              <td>{dash(entry.collectedByName)}</td>
              <td>{METHOD_LABEL[entry.method]}</td>
              <td>{dash(entry.overrideReason)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

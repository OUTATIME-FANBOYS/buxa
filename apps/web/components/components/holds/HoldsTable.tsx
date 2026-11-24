import Link from 'next/link';
import type { ClockFormat } from '@buxa/domain';
import { formatCampDateTime } from '@buxa/shared';
import { sessionTabPath } from '@/config/routes';

/** One live hold, as the holds screen shows it. Times are ISO strings, shown in camp time. */
export interface HoldRow {
  id: string;
  sessionId: string;
  sessionName: string;
  className: string;
  householdName: string;
  childName: string | null;
  createdAt: string;
  expiresAt: string;
}

/** The camp's live holds, soonest expiry first (the order they come in). Read only. */
export function HoldsTable({
  holds,
  timeZone,
  clockFormat,
}: {
  holds: readonly HoldRow[];
  timeZone: string;
  clockFormat: ClockFormat;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Places held across the camp, soonest to expire first</caption>
        <thead>
          <tr>
            <th scope="col">Session</th>
            <th scope="col">Class</th>
            <th scope="col">Family</th>
            <th scope="col">Child</th>
            <th scope="col">Placed</th>
            <th scope="col">Expires</th>
          </tr>
        </thead>
        <tbody>
          {holds.map(hold => (
            <tr key={hold.id}>
              <td>
                <Link className="link" href={sessionTabPath(hold.sessionId, 'holds')}>
                  {hold.sessionName}
                </Link>
              </td>
              <td>{hold.className}</td>
              <td>{hold.householdName}</td>
              <td>{hold.childName ?? <span className="muted">Not recorded</span>}</td>
              <td>{formatCampDateTime(hold.createdAt, timeZone, clockFormat)}</td>
              <td>{formatCampDateTime(hold.expiresAt, timeZone, clockFormat)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

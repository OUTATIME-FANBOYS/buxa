import Link from 'next/link';
import type { ClockFormat } from '@buxa/domain';
import { formatCampDateTime } from '@buxa/shared';
import { sessionTabPath } from '@/config/routes';

/** One waitlisted camper, as the holds screen shows it. `joinedAt` is an ISO string, shown in camp time. */
export interface WaitRow {
  id: string;
  sessionId: string;
  sessionName: string;
  classId: string;
  className: string;
  householdName: string | null;
  camperName: string;
  joinedAt: string;
}

/**
 * Each class's waitlist, in the order the campers joined. The position counts up within each class, so the first waiting camper of
 * every class is 1. Read only: moving a camper off the waitlist is on the class page.
 */
export function WaitlistTable({
  rows,
  timeZone,
  clockFormat,
}: {
  rows: readonly WaitRow[];
  timeZone: string;
  clockFormat: ClockFormat;
}) {
  const seen = new Map<string, number>();
  const positioned = rows.map(row => {
    const position = (seen.get(row.classId) ?? 0) + 1;
    seen.set(row.classId, position);

    return { row, position };
  });

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Waitlists by class, in the order the campers joined</caption>
        <thead>
          <tr>
            <th scope="col">Class</th>
            <th scope="col">Place in line</th>
            <th scope="col">Family</th>
            <th scope="col">Camper</th>
            <th scope="col">Joined</th>
          </tr>
        </thead>
        <tbody>
          {positioned.map(({ row, position }) => (
            <tr key={row.id}>
              <td>
                {row.className}{' '}
                <Link className="link muted" href={sessionTabPath(row.sessionId, 'holds')}>
                  {row.sessionName}
                </Link>
              </td>
              <td>{position}</td>
              <td>{row.householdName ?? <span className="muted">No family</span>}</td>
              <td>{row.camperName}</td>
              <td>{formatCampDateTime(row.joinedAt, timeZone, clockFormat)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

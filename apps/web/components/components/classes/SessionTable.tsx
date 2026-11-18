import type { Session } from '@buxa/contracts';
import { classPath } from '@/config/routes';
import { formatCampDateTime } from '@buxa/shared';
import { SessionStatus } from './SessionStatus';
import type { ClockFormat } from '@buxa/domain';
import { Button } from '@/components/elements/export';

/** The session's instructors by name, comma separated. A session with none says so. */
export const instructorNames = (session: Pick<Session, 'instructors'>): string =>
  session.instructors.length === 0 ? 'None yet' : session.instructors.map(i => i.name).join(', ');

/**
 * The class's sessions, with instructors, capacity, enrolled and waitlisted counts. Times are the camp's own clock. The link opens that session's
 * enrolments on the same page (a query parameter, so it works without JavaScript).
 */
export function SessionTable({ classId, sessions, timeZone, clockFormat, selectedId }: {
  classId: string; sessions: readonly Session[]; timeZone: string; clockFormat: ClockFormat; selectedId: string | null;
}) {
  return (
    <div className="table-wrap"><table className="table">
      <caption className="sr-only">Sessions of this class, in camp time</caption>
      <thead><tr>
        <th scope="col">Starts</th><th scope="col">Ends</th><th scope="col">Location</th><th scope="col">Instructors</th><th scope="col">Capacity</th>
        <th scope="col">Enrolled</th><th scope="col">Waitlisted</th><th scope="col">Places</th><th scope="col"><span className="sr-only">Actions</span></th>
      </tr></thead>
      <tbody>
        {sessions.map(session => {
          const selected = session.id === selectedId;

          return (
            <tr key={session.id}>
              <td>{formatCampDateTime(session.startsAt, timeZone, clockFormat)}</td>
              <td>{formatCampDateTime(session.endsAt, timeZone, clockFormat)}</td>
              <td>{session.location}</td>
              <td>{instructorNames(session)}</td>
              <td>{session.capacity}</td>
              <td>{session.seatsTaken}</td>
              <td>{session.waitlisted}</td>
              <td><SessionStatus session={session} /></td>
              <td>
                <Button variant="ghost" className="classes-target" aria-current={selected ? 'true' : undefined}
                  href={`${classPath(classId)}?session=${encodeURIComponent(session.id)}#enrolments`}>
                  {selected ? 'Showing enrolments' : 'Enrolments'}
                  <span className="sr-only"> for the session starting {formatCampDateTime(session.startsAt, timeZone, clockFormat)}</span>
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table></div>
  );
}

import Link from 'next/link';
import type { Session } from '@buxa/contracts';
import { sessionPath } from '@/config/routes';

/** The camp's sessions: name, the date range it covers, and how many classes it holds. */
export function SessionsTable({ sessions }: { sessions: readonly Session[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Sessions in the camp</caption>
        <thead>
          <tr>
            <th scope="col">Session</th>
            <th scope="col">Dates</th>
            <th scope="col">Classes</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map(session => (
            <tr key={session.id}>
              <td>
                <Link className="row-title classes-target" href={sessionPath(session.id)}>
                  {session.name}
                </Link>
              </td>
              <td>
                {session.startsOn && session.endsOn ? `${session.startsOn} to ${session.endsOn}` : 'Dates not set yet'}
              </td>
              <td>{session.classCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import Link from 'next/link';
import type { UpcomingSession } from '@buxa/shared/camp/campHomeTypes';
import { ROUTES } from '@/config/routes';

const when = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * The next sessions across the camp's classes, as a table, with See all to the Classes page. Null means the viewer may not read
 * classes; an empty list means none are scheduled. Each row is the same session the Classes pages list.
 */
export function UpcomingSessionsPanel({ sessions }: { sessions: readonly UpcomingSession[] | null }) {
  return (
    <section className="panel" aria-labelledby="upcoming-classes-title">
      <div className="panel-head">
        <h2 id="upcoming-classes-title">Upcoming classes</h2>
        {sessions !== null && (
          <Link className="link" href={ROUTES.classes}>
            See all<span className="sr-only"> classes</span>
          </Link>
        )}
      </div>
      {sessions === null ? (
        <p className="muted">Classes are not shown for your role.</p>
      ) : sessions.length === 0 ? (
        <p className="muted">No upcoming classes are scheduled.</p>
      ) : (
        <div className="home-table-scroll">
          <table className="home-table">
            <caption className="sr-only">The next {sessions.length} class sessions, soonest first</caption>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">When</th>
                <th scope="col">Where</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td>{s.className}</td>
                  <td>{when(s.startsAt)}</td>
                  <td>{s.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

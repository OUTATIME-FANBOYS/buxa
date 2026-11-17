import Link from 'next/link';
import type { UpcomingSession } from '@buxa/shared/camp/campHomeTypes';
import { ROUTES } from '@/config/routes';

const when = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * The next sessions across the camp's classes. Null means the viewer may not read classes; an empty list means none are scheduled.
 * Each line is the same session the Classes pages list.
 */
export function UpcomingClassesPanel({ sessions }: { sessions: readonly UpcomingSession[] | null }) {
  return (
    <section className="panel" aria-labelledby="upcoming-classes-title">
      <div className="panel-head"><h2 id="upcoming-classes-title">Upcoming classes</h2></div>
      {sessions === null ? (
        <p className="muted">Classes are not shown for your role.</p>
      ) : sessions.length === 0 ? (
        <p className="muted">No upcoming classes are scheduled.</p>
      ) : (
        <ul className="plain-list">
          {sessions.map(s => (
            <li key={s.id}>
              <span className="row-title">{s.className}</span>{' '}
              <span className="muted small">{when(s.startsAt)}, {s.location}</span>
            </li>
          ))}
        </ul>
      )}
      {sessions !== null && <Link className="link" href={ROUTES.classes}>Open Classes</Link>}
    </section>
  );
}

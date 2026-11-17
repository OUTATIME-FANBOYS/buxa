import Link from 'next/link';
import { ROUTES } from '@/config/routes';

/**
 * How many people are on site now, with the link to the list. A null count means the viewer's role may not read attendance,
 * so the panel says that in a sentence rather than showing a number or disappearing.
 */
export function OnSitePanel({ count }: { count: number | null }) {
  return (
    <section className="panel" aria-labelledby="on-site-title">
      <div className="panel-head"><h2 id="on-site-title">On site now</h2></div>
      {count === null ? (
        <p className="muted">Attendance is not shown for your role.</p>
      ) : count === 0 ? (
        <p className="muted">Nobody is checked in right now.</p>
      ) : (
        <p className="home-count"><span className="stat-num">{count}</span> {count === 1 ? 'person' : 'people'} checked in</p>
      )}
      {count !== null && <Link className="link" href={ROUTES.onSite}>Open On site</Link>}
    </section>
  );
}

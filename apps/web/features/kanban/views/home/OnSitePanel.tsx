import Link from 'next/link';
import { ROUTES } from '../../../../config/routes';

/** How many people are on site now, with the link to the list. Shown only to roles that may read attendance. */
export function OnSitePanel({ count }: { count: number }) {
  return (
    <section className="panel" aria-labelledby="on-site-title">
      <div className="panel-head"><h2 id="on-site-title">On site now</h2></div>
      <p className="home-count"><span className="stat-num">{count}</span> {count === 1 ? 'person' : 'people'} checked in</p>
      <Link className="link" href={ROUTES.onSite}>Open On site</Link>
    </section>
  );
}

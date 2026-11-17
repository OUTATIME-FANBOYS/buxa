import Link from 'next/link';
import type { MembershipStatusCounts } from '@buxa/shared/camp/campHomeTypes';
import { ROUTES } from '@/config/routes';
import { donutSegments } from './homeChartMath';

const RADIUS = 42;
const STROKE = 14;
const LENGTH = 2 * Math.PI * RADIUS;
/** Each status's fill from the palette. The legend beside the ring names every segment in words, so colour is never the only key. */
const FILL: Record<keyof MembershipStatusCounts, string> = {
  valid: 'var(--f-ok)', notStarted: 'var(--f-brand)', expired: 'var(--f-warn)', none: 'var(--f-neutral)',
};

/**
 * Membership status across the camp list, as a ring with a text legend (count and share for each status). A null count means the
 * viewer's role may not read membership status, so the panel says so instead of drawing an empty ring.
 */
export function MembershipPanel({ counts }: { counts: MembershipStatusCounts | null }) {
  const total = counts ? counts.valid + counts.notStarted + counts.expired + counts.none : 0;
  const segments = counts ? donutSegments(counts, LENGTH) : [];
  const summary = counts
    ? `Membership status for ${total} ${total === 1 ? 'person' : 'people'}: ${segments.map(s => `${s.count} ${s.label.toLowerCase()}`).join(', ') || 'none yet'}.`
    : '';

  return (
    <section className="panel" aria-labelledby="membership-title">
      <div className="panel-head"><h2 id="membership-title">Membership status</h2></div>
      {counts === null ? (
        <p className="muted">Memberships are not shown for your role.</p>
      ) : total === 0 ? (
        <p className="muted">No people are on the camp list yet.</p>
      ) : (
        <div className="home-donut-row">
          <div className="home-donut" role="img" aria-label={summary}>
            <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" focusable="false">
              <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--track)" strokeWidth={STROKE} />
              {segments.map(s => (
                <circle key={s.key} cx="60" cy="60" r={RADIUS} fill="none" stroke={FILL[s.key]} strokeWidth={STROKE}
                  strokeDasharray={`${s.dash} ${LENGTH - s.dash}`} strokeDashoffset={s.offset} transform="rotate(-90 60 60)" />
              ))}
            </svg>
            <span className="home-donut-total" aria-hidden="true"><span className="stat-num">{total}</span><span className="muted small">people</span></span>
          </div>
          <ul className="home-legend" aria-label="Membership status, by count">
            {segments.map(s => (
              <li key={s.key}>
                <i className="sw" style={{ background: FILL[s.key] }} aria-hidden="true" />
                <span className="home-legend-label">{s.label}</span>
                <span className="home-legend-count">{s.count} <span className="muted small">({s.percent}%)</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {counts !== null && total > 0 && <p className="muted small">Each person is counted once, by their status today.</p>}
      {counts !== null && <Link className="link" href={ROUTES.people}>Open People</Link>}
    </section>
  );
}

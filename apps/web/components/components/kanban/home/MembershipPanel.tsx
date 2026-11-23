import Link from 'next/link';
import type { MembershipStatusCounts } from '@buxa/shared/camp/campHomeTypes';
import { ROUTES } from '@/config/routes';
import { ChartCard } from '@/components/components/charts';
import { type ChartTone, Ring } from '@/components/elements';

/** The statuses in the order the ring and legend show them, each with the tone it is filled with. */
const STATUSES: { key: keyof MembershipStatusCounts; label: string; tone: ChartTone }[] = [
  { key: 'valid', label: 'Valid', tone: 'ok' },
  { key: 'notStarted', label: 'Not started', tone: 'brand' },
  { key: 'expired', label: 'Expired', tone: 'warn' },
  { key: 'none', label: 'None (includes revoked)', tone: 'neutral' },
];

/**
 * Membership status across the camp list, as a ring with a text legend (count and share for each status). A null count means the
 * viewer's role may not read membership status, so the panel says so instead of drawing an empty ring.
 */
export function MembershipPanel({ counts }: { counts: MembershipStatusCounts | null }) {
  const total = counts ? STATUSES.reduce((sum, s) => sum + counts[s.key], 0) : 0;
  const rows = counts
    ? STATUSES.filter(s => counts[s.key] > 0).map(s => ({
        ...s,
        count: counts[s.key],
        percent: Math.round((counts[s.key] / total) * 100),
      }))
    : [];
  const summary = counts
    ? `Membership status for ${total} ${total === 1 ? 'person' : 'people'}: ${rows.map(r => `${r.count} ${r.label.toLowerCase()}`).join(', ') || 'none yet'}.`
    : '';

  return (
    <ChartCard
      titleId="membership-title"
      title="Membership status"
      value={counts ? total : '—'}
      subtitle="people on the camp list"
    >
      {counts === null ? (
        <p className="muted">Memberships are not shown for your role.</p>
      ) : total === 0 ? (
        <p className="muted">No people are on the camp list yet.</p>
      ) : (
        <div className="home-membership-row">
          <Ring
            value={total ? (counts.valid / total) * 100 : 0}
            size={96}
            stroke={8}
            label="valid"
            tone="ok"
            summary={summary}
          />
          <ul className="home-legend" aria-label="Membership status, by count">
            {rows.map(r => (
              <li key={r.key}>
                <i className="sw" style={{ background: `var(--f-${r.tone})` }} aria-hidden="true" />
                <span className="home-legend-label">{r.label}</span>
                <span className="home-legend-count">
                  {r.count} <span className="muted small">({r.percent}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {counts !== null && total > 0 && (
        <p className="muted small">Each person is counted once, by their status today.</p>
      )}
      {counts !== null && (
        <Link className="link" href={ROUTES.people}>
          Open People
        </Link>
      )}
    </ChartCard>
  );
}

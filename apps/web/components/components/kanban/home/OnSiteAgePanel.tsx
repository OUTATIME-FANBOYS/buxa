import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import { ChartCard } from '@/components/components/charts';
import { PARENTS_LABEL, STUDENTS_LABEL } from './ageGroups';

/**
 * Parents and guardians, and students, on site now, as bars with their numbers written beside them. A null split means this viewer's
 * role may not see the minor flag (or attendance), so the panel says so rather than guessing. The big number is the total on site,
 * or a dash when the viewer may not see it.
 */
export function OnSiteAgePanel({ counts }: { counts: { adults: number; minors: number } | null }) {
  return (
    <ChartCard
      titleId="on-site-age-title"
      title={`On site: ${PARENTS_LABEL} and ${STUDENTS_LABEL}`}
      value={counts ? counts.adults + counts.minors : '—'}
      subtitle="on site now"
    >
      {counts === null ? (
        <p className="muted">Age groups are not shown for your role.</p>
      ) : counts.adults + counts.minors === 0 ? (
        <p className="muted">Nobody is checked in right now.</p>
      ) : (
        <ul className="home-age-list" aria-label="On site now, by age group">
          {[
            { label: PARENTS_LABEL, n: counts.adults },
            { label: STUDENTS_LABEL, n: counts.minors },
          ].map(row => (
            <li key={row.label} className="home-age-row">
              <span className="home-age-name">{row.label}</span>
              <span className="home-age-track" aria-hidden="true">
                <span
                  className="home-age-fill"
                  style={{ width: `${(row.n / Math.max(1, counts.adults, counts.minors)) * 100}%` }}
                />
              </span>
              <span className="stat-num home-age-num">{row.n}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        Age groups come from each person&apos;s record. Right now only; this is not a weekly total.
      </p>
      {counts !== null && (
        <Link className="link" href={ROUTES.onSite}>
          Open On site
        </Link>
      )}
    </ChartCard>
  );
}

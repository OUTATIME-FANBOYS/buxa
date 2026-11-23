import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import { ChartCard, HBars } from '@/components/components/charts';
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
        <HBars
          ariaLabel="On site now, by age group"
          rows={[
            { label: PARENTS_LABEL, segments: [{ value: counts.adults, className: 'seg-brand', name: 'on site' }] },
            { label: STUDENTS_LABEL, segments: [{ value: counts.minors, className: 'seg-brand', name: 'on site' }] },
          ]}
        />
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

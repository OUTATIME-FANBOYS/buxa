import type { ProfileBadgeRow } from '@buxa/shared';
import { BadgeReveal } from './BadgeReveal';

interface ProfileBadgesProps {
  badges: readonly ProfileBadgeRow[];
  campName: string | null;
}

/**
 * The profile's badge section: the signed-in person's own badge, and one per child for a guardian. Each shows a Show button when it
 * has an active badge, and "No badge yet" when it has none. With no person record in the camp, nothing is shown.
 */
export function ProfileBadges({ badges, campName }: ProfileBadgesProps) {
  if (badges.length === 0 || campName === null) {
    return null;
  }

  const heading = badges.some(badge => badge.self) ? 'Your badge' : 'Badges';

  return (
    <section className="panel profile-badges" aria-labelledby="profile-badges-heading">
      <div className="panel-head">
        <h2 id="profile-badges-heading" className="people-heading">
          {heading}
        </h2>
      </div>
      <div className="stack">
        {badges.map(badge => (
          <div key={badge.personId} className="stack profile-badge">
            {!badge.self && <h3 className="profile-badge-name">{badge.name}</h3>}
            {badge.hasActiveBadge ? (
              <BadgeReveal
                personId={badge.personId}
                personName={badge.name}
                roleLabel={badge.roleLabel}
                campName={campName}
              />
            ) : (
              <p className="muted">No badge yet</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

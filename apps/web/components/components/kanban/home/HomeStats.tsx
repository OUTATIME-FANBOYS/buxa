import type { CampHome } from '@buxa/shared/camp/campHomeTypes';
import { homeCards } from '@buxa/shared';
import { StatCard } from './StatCard';

/** The three camp facts for Home in one row, each with what it counts and a change chip. A fact the viewer may not read has no card. */
export function HomeStats({ camp }: { camp: CampHome }) {
  return (
    <div className="stats stats-home" aria-label="At a glance">
      {homeCards(camp).map(card => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          tone={card.tone}
          info={card.info}
          change={card.change}
        />
      ))}
    </div>
  );
}

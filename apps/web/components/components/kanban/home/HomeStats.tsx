import type { CampHome } from '@buxa/shared/camp/campHomeTypes';
import { homeCards } from '@buxa/shared';
import { StatCard } from './StatCard';

/** The three camp facts for Home in one row, each with what it counts and a change chip. A fact the viewer may not read has no card. */
export function HomeStats({ camp }: { camp: CampHome }) {
  // The check-ins series behind "Checked in today": the last 14 days, the same window as the chart's default. Only the card with
  // that series gets a line; the others have no daily data on this page, so they have none.
  const checkIns = camp.checkInsByDay?.days.slice(-14).map(day => day.count) ?? null;

  return (
    <div className="stats stats-home" aria-label="At a glance">
      {homeCards(camp).map(card => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          tone={card.tone}
          change={card.change}
          spark={
            card.label === 'Checked in today' && checkIns
              ? { values: checkIns, ariaLabel: 'Check-ins per day, last 14 days' }
              : undefined
          }
        />
      ))}
    </div>
  );
}

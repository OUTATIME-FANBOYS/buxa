import type { CampHome } from '@/logic/composers/index.server';
import type { TaskCounts } from '@buxa/shared';
import { homeCards } from '@buxa/shared';
import { StatCard } from './StatCard';

/** One row for the whole Home: camp facts and task facts side by side. */
export function HomeStats({ camp, tasks }: { camp: CampHome | null; tasks: TaskCounts }) {
  return (
    <div className="stats stats-home" aria-label="At a glance">
      {homeCards(camp, tasks).map(card => <StatCard key={card.label} {...card} />)}
    </div>
  );
}

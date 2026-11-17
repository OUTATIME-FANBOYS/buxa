'use client';

import type { CampHome } from '@buxa/shared/camp/campHomeTypes';
import { useStore } from '@buxa/middleware/providers/providers';
import { HomeHeader } from '@/components/components/kanban/home/export';
import { HomeStats } from '@/components/components/kanban/home/export';
import { OnSitePanel } from '@/components/components/kanban/home/export';
import { UpcomingClassesPanel } from '@/components/components/kanban/home/export';
import { YourTasksPanel } from '@/components/components/kanban/home/export';

/**
 * Home for the signed-in camp: the camp's facts from the server (`camp`), and the open tasks assigned to the signed-in person
 * from the browser store. Each section says what it shows, or why it cannot show anything, rather than leaving a blank.
 */
export function Dashboard({ camp }: { camp: CampHome }) {
  const { s, me, kindOf } = useStore();
  const mine = s.tasks.filter(t => !t.archived && t.assigneeId === me?.id && kindOf(t) !== 'done');
  const firstName = camp.firstName || me?.name.split(' ')[0] || '';
  return (
    <div className="page">
      <HomeHeader firstName={firstName} camp={camp} />
      <HomeStats camp={camp} />
      <div className="grid-2">
        <OnSitePanel count={camp.onSite} />
        <UpcomingClassesPanel sessions={camp.upcomingSessions} />
        <YourTasksPanel tasks={mine} />
      </div>
    </div>
  );
}

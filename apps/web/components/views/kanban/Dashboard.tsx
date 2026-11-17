'use client';

import type { CampHome } from '@buxa/shared/camp/campHomeTypes';
import { useStore } from '@buxa/middleware/providers/providers';
import { CheckInsPanel } from '@/components/components/kanban/home/export';
import { HomeHeader } from '@/components/components/kanban/home/export';
import { HomeStats } from '@/components/components/kanban/home/export';
import { MembershipPanel } from '@/components/components/kanban/home/export';
import { OnSiteAgePanel } from '@/components/components/kanban/home/export';
import { UpcomingSessionsPanel } from '@/components/components/kanban/home/export';
import { YourTasksPanel } from '@/components/components/kanban/home/export';

/**
 * Home for the signed-in camp. Row by row: three numbers, the check-ins chart with the age-group bars beside it, membership status
 * with the next classes, then the open tasks given to the signed-in person (from the browser store). Each section says what it
 * shows, or why it cannot show anything, rather than leaving a blank.
 */
export function Dashboard({ camp }: { camp: CampHome }) {
  const { s, me, kindOf } = useStore();
  const mine = s.tasks.filter(t => !t.archived && t.assigneeId === me?.id && kindOf(t) !== 'done');
  const firstName = camp.firstName || me?.name.split(' ')[0] || '';

  return (
    <div className="page">
      <HomeHeader firstName={firstName} camp={camp} />
      <HomeStats camp={camp} />
      <div className="home-row home-row-main">
        <CheckInsPanel series={camp.checkInsByDay} />
        <OnSiteAgePanel counts={camp.onSiteByAge} />
      </div>
      <div className="home-row home-row-even">
        <MembershipPanel counts={camp.membershipStatus} />
        <UpcomingSessionsPanel sessions={camp.upcomingSessions} />
      </div>
      <YourTasksPanel tasks={mine} />
    </div>
  );
}

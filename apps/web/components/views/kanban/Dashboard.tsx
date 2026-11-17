'use client';

import { Empty } from '@/components/components/export';
import type { CampHome } from '@buxa/shared/camp/campHomeTypes';
import { useStore } from '@buxa/middleware/providers/providers';
import { taskCounts } from '@buxa/shared';
import { HomeHeader } from '@/components/components/kanban/home/export';
import { HomeStats } from '@/components/components/kanban/home/export';
import { OnSitePanel } from '@/components/components/kanban/home/export';
import { StaffTasksPanel } from '@/components/components/kanban/home/export';

/**
 * Home: one page. With a camp it shows the camp's facts and the staff tasks together; without one (the browser demo) it shows the tasks alone.
 * Camp facts come from the server (`camp`); task facts come from the browser store.
 */
export function Dashboard({ camp }: { camp: CampHome | null }) {
  const { me, wsTasks, kindOf, workspace } = useStore();
  if (!workspace) return <Empty icon="folder" title="No workspace" />;
  const tasks = taskCounts(wsTasks, kindOf);
  const firstName = camp?.firstName ?? me?.name.split(' ')[0] ?? '';
  return (
    <div className="page">
      <HomeHeader firstName={firstName} camp={camp} />
      <HomeStats camp={camp} tasks={tasks} />
      <div className="grid-2">
        {camp && camp.onSite !== null && <OnSitePanel count={camp.onSite} />}
        <StaffTasksPanel tasks={tasks} />
      </div>
    </div>
  );
}

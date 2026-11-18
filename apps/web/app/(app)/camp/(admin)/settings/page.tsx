import type { Metadata } from 'next';
import { authorize } from '@buxa/domain';
import { campContext, loadCampProfile } from '@buxa/server/composers/index.server';
import { CampClockPanel } from '@/components/components/camp/export';
import { SettingsPage } from '@/components/views/kanban/export';
import { listArchivedCamps } from '@/actions/camp';

export const metadata: Metadata = { title: 'Settings' };

/** Settings for the camp. An archived camp is read-only: no clock change, no danger zone. Only the owner may delete. */
export default async function Page() {
  const { actor, camp, session } = await campContext();
  const org = await loadCampProfile(actor);
  const archivedCamps = await listArchivedCamps();
  const archived = archivedCamps.some(c => c.id === camp.orgId);

  return (
    <SettingsPage
      user={session.user}
      clock={
        <CampClockPanel
          campId={camp.orgId}
          clockFormat={org.clockFormat}
          canChange={authorize(actor, 'org:update').allow && !archived}
        />
      }
      camp={{ id: camp.orgId, name: org.name, canDelete: authorize(actor, 'org:delete').allow, archived }}
      archivedCamps={archivedCamps}
    />
  );
}

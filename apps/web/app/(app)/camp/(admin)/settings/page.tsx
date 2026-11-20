import type { Metadata } from 'next';
import { authorize } from '@buxa/domain';
import { campContext, loadCampProfile } from '@buxa/server/composers/index.server';
import { SettingsPage } from '@/components/views/kanban';
import { listArchivedCamps } from '@/actions/camp';

export const metadata: Metadata = { title: 'Settings' };

/** Settings for the camp. The person's own settings are on /account. An archived camp is read-only: no danger zone. Only the owner may delete. */
export default async function Page() {
  const { actor, camp } = await campContext();
  const org = await loadCampProfile(actor);
  const archivedCamps = await listArchivedCamps();
  const archived = archivedCamps.some(c => c.id === camp.orgId);

  return (
    <SettingsPage
      camp={{
        id: camp.orgId,
        name: org.name,
        canDelete: authorize(actor, 'org:delete').allow,
        canManageFeed: authorize(actor, 'org:update').allow,
        isTeacher: actor.role === 'teacher',
        archived,
      }}
      archivedCamps={archivedCamps}
    />
  );
}

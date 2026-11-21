import type { Metadata } from 'next';
import { authorize } from '@buxa/domain';
import { campContext, loadCampProfile } from '@buxa/server/composers/index.server';
import { SettingsPage } from '@/components/views/kanban';
import { listArchivedCamps } from '@/actions/camp';

export const metadata: Metadata = { title: 'Settings' };

/**
 * Settings for the camp. The person's own settings are on /account. An archived camp is read-only: no camp name card and no
 * danger zone. Rename and archive follow org:update and org:archive (owner and admin); delete is the owner only (org:delete).
 */
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
        canRename: authorize(actor, 'org:update').allow,
        canArchive: authorize(actor, 'org:archive').allow,
        canDelete: authorize(actor, 'org:delete').allow,
        canManageFeed: authorize(actor, 'org:update').allow,
        isTeacher: actor.role === 'teacher',
        archived,
      }}
      archivedCamps={archivedCamps}
    />
  );
}

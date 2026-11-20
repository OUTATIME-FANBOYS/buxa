import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { loadMembers, loadTeacherOptions } from '@buxa/server/composers/index.server';
import { MembersTable, PermissionAreasTable } from '@/components/components/camp';
import { AddTeacherButton, PageHeader } from '@/components/components';
import { campContext } from '@buxa/server/composers/index.server';

export async function Members() {
  const { actor } = await campContext();
  // A teacher has no team page in the sidebar, and the page does not open for them by address either.
  if (!can(actor, 'members:read')) {
    notFound();
  }
  const { members } = await loadMembers(actor);
  const teacherOptions = await loadTeacherOptions(actor, members);
  const subtitle = `${members.length} ${members.length === 1 ? 'person has' : 'people have'} access to this camp.`;
  const canInvite = can(actor, 'members:invite', { orgId: actor.orgId, newRole: 'teacher' });

  return (
    <div className="page">
      <PageHeader title="Team access" subtitle={subtitle} actions={canInvite ? <AddTeacherButton /> : undefined} />
      <MembersTable members={members} showEmail={can(actor, 'members:read_contact')} teacherOptions={teacherOptions} />
      <PermissionAreasTable />
    </div>
  );
}

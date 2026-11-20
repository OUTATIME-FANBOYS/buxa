import { can } from '@buxa/domain';
import { loadMembers, loadTeacherOptions } from '@buxa/server/composers/index.server';
import { MembersTable, PermissionAreasTable } from '@/components/components/camp';
import { PageHeader } from '@/components/components';
import { campContext } from '@buxa/server/composers/index.server';

export async function Members() {
  const { actor } = await campContext();
  const { members } = await loadMembers(actor);
  const teacherOptions = await loadTeacherOptions(actor, members);
  const subtitle = `${members.length} ${members.length === 1 ? 'person has' : 'people have'} access to this camp. Inviting people is not available yet.`;

  return (
    <div className="page">
      <PageHeader title="Team access" subtitle={subtitle} />
      <MembersTable members={members} showEmail={can(actor, 'members:read_contact')} teacherOptions={teacherOptions} />
      <PermissionAreasTable />
    </div>
  );
}

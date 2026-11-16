import { can } from '@buxa/domain';
import { loadMembers } from '@/logic/composers/index.server';
import { MembersTable } from '@/components/export';
import { PageHeader } from '@/components/export';
import { campContext } from '@/logic/composers/index.server';

export async function Members() {
  const { actor } = await campContext();
  const { members } = await loadMembers(actor);
  const subtitle = `${members.length} ${members.length === 1 ? 'person has' : 'people have'} access to this camp. Inviting people is not available yet.`;

  return (
    <div className="page">
      <PageHeader title="Team access" subtitle={subtitle} />
      <MembersTable members={members} showEmail={can(actor, 'members:read_contact')} />
    </div>
  );
}

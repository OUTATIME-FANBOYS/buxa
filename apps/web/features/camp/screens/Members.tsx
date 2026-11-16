import { can } from '@buxa/domain';
import { getRuntime } from '../../../server/runtime';
import { MembersTable } from '../components/MembersTable';
import { PageHeader } from '../../../components/ui/PageHeader';
import { campContext } from '../../../logic/composers/index.server';

export async function Members() {
  const { actor } = await campContext();
  const { members } = await getRuntime().services.orgs.listMembers(actor);
  const subtitle = `${members.length} ${members.length === 1 ? 'person has' : 'people have'} access to this camp. Inviting people is not available yet.`;

  return (
    <div className="page">
      <PageHeader title="Team access" subtitle={subtitle} />
      <MembersTable members={members} showEmail={can(actor, 'members:read_contact')} />
    </div>
  );
}

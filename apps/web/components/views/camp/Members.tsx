import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { loadMembers, loadTeacherOptions } from '@buxa/server/composers/index.server';
import { MembersTable } from '@/components/components/camp';
import { PageHeader } from '@/components/components';
import { Button } from '@/components/elements';
import { ROUTES } from '@/config/routes';
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
  const canManage = can(actor, 'members:change_role');

  return (
    <div className="page">
      <PageHeader
        title="Team access"
        subtitle={subtitle}
        actions={
          canManage ? (
            <Button href={ROUTES.membersManage} variant="primary" size="header" icon="shield">
              Manage access
            </Button>
          ) : undefined
        }
      />
      <MembersTable members={members} showEmail={can(actor, 'members:read_contact')} teacherOptions={teacherOptions} />
    </div>
  );
}

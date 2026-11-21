import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { loadMembers, campContext } from '@buxa/server/composers/index.server';
import { ManageAccessTable } from '@/components/components/camp';
import { PageHeader } from '@/components/components';
import { Button } from '@/components/elements';
import { ROUTES } from '@/config/routes';

/** Manage access: each member's role, changed one row at a time. Only people who may change roles see it. */
export async function ManageAccess() {
  const { actor } = await campContext();
  if (!can(actor, 'members:change_role')) {
    notFound();
  }
  const { members } = await loadMembers(actor);

  return (
    <div className="page narrow">
      <PageHeader
        title="Manage access"
        subtitle="Change what each person may do in this camp."
        actions={
          <Button href={ROUTES.members} variant="glass" size="header">
            Back to team access
          </Button>
        }
      />
      <ManageAccessTable members={members} currentUserId={actor.userId} />
    </div>
  );
}

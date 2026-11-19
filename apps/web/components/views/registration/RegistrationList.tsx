import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { FORBIDDEN_REGISTRATION } from '@buxa/shared';
import { currentActor, loadForms } from '@buxa/server/composers/index.server';
import { ROUTES } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components';
import { FormsTable } from '@/components/components/registration';
import { Button } from '@/components/elements';

/**
 * The camp's registration forms. Anyone who may read them sees the list; only staff with registration:manage see the New form button.
 */
export async function RegistrationList() {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const canManage = can(actor, 'registration:manage');
  const loaded = await loadForms(actor);

  const actions = canManage ? (
    <Button variant="primary" icon="plus" href={ROUTES.newRegistrationForm}>
      New form
    </Button>
  ) : undefined;

  return (
    <div className="page">
      <PageHeader
        title="Registration"
        subtitle="Forms families fill in to register campers for sessions. Nothing is charged in this phase."
        actions={actions}
      />
      {!loaded.ok ? (
        <Empty icon="alert" title="You cannot see registration forms" body={FORBIDDEN_REGISTRATION} />
      ) : loaded.value.length === 0 ? (
        <Empty
          icon="list"
          title="No registration forms yet"
          body={
            canManage
              ? 'Create a form for a season, choose its sessions and add any questions. Publish it to start taking registrations.'
              : 'Nobody has created a registration form yet.'
          }
          action={canManage ? actions : undefined}
        />
      ) : (
        <FormsTable forms={loaded.value} />
      )}
    </div>
  );
}

import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { FORBIDDEN_REGISTRATION } from '@buxa/shared';
import { currentActor, loadSessions } from '@buxa/server/composers/index.server';
import { Empty, PageHeader } from '@/components/components';
import { FormEditor } from '@/components/components/registration';

/** Creates a registration form for a season: its name, its sessions and its questions. Only staff with registration:manage. */
export async function NewRegistrationFormView() {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  if (!can(actor, 'registration:manage')) {
    return (
      <div className="page">
        <Empty icon="alert" title="You cannot create registration forms" body={FORBIDDEN_REGISTRATION} />
      </div>
    );
  }
  const sessions = await loadSessions(actor);

  return (
    <div className="page">
      <PageHeader
        title="New registration form"
        subtitle="A form for one season. It takes registrations once it is published."
      />
      {sessions.ok ? (
        <FormEditor mode="create" sessions={sessions.value.map(s => ({ id: s.id, name: s.name }))} />
      ) : (
        <Empty icon="alert" title="You cannot see sessions" body={FORBIDDEN_REGISTRATION} />
      )}
    </div>
  );
}

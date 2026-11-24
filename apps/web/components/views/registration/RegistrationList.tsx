import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { FORBIDDEN_REGISTRATION } from '@buxa/shared';
import { currentActor, loadFormSubmissions, loadSessions } from '@buxa/server/composers/index.server';
import { Empty, PageHeader } from '@/components/components';
import {
  FormsTable,
  NewRegistrationFormButton,
  RegistrationSearch,
  registrationSearchRows,
} from '@/components/components/registration';

/**
 * The camp's registration forms, then every registration across all sessions with a search box. Each registration's row links to its
 * session's Registrations tab. Anyone who may read registration sees the list; only staff with registration:manage see the New form
 * button, which opens the create form in a dialog.
 */
export async function RegistrationList() {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const canManage = can(actor, 'registration:manage');
  // One read gives the forms and their registrations; the search list and the forms table both come from it.
  const loaded = await loadFormSubmissions(actor);
  const sessions = canManage ? await loadSessions(actor) : null;

  const actions =
    canManage && sessions?.ok ? (
      <NewRegistrationFormButton sessions={sessions.value.map(s => ({ id: s.id, name: s.name }))} />
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
        <>
          <FormsTable forms={loaded.value.map(entry => entry.form)} />
          <section className="registration-section" aria-labelledby="registrations-list-heading">
            <h2 id="registrations-list-heading" className="people-subheading">
              Registrations
            </h2>
            <RegistrationSearch rows={registrationSearchRows(loaded.value)} />
          </section>
        </>
      )}
    </div>
  );
}

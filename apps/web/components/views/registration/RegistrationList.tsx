import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import {
  ALL_SESSIONS,
  chosenSession,
  defaultSessionChoice,
  FORBIDDEN_REGISTRATION,
  inChosenSession,
  knownSessions,
  SESSION_PARAM,
} from '@buxa/shared';
import { ROUTES } from '@/config/routes';
import { currentActor, loadFormSubmissions, loadSessions } from '@buxa/server/composers/index.server';
import { Empty, PageHeader, PageHeaderRow } from '@/components/components';
import { SessionFilter } from '@/components/components/filters';
import {
  FormsTable,
  NewRegistrationFormButton,
  RegistrationSearch,
  registrationSearchRows,
} from '@/components/components/registration';

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/**
 * The camp's registration forms, then every registration across all sessions with a search box. Each registration's row links to its
 * session's Registrations tab. Anyone who may read registration sees the list; only staff with registration:manage see the New form
 * button, which opens the create form in a dialog. The session filter (`?session=`) narrows the forms and registrations to one session.
 */
export async function RegistrationList({ searchParams = {} }: { searchParams?: SearchParams } = {}) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const canManage = can(actor, 'registration:manage');
  // One read gives the forms and their registrations; the filter's choices come from it and from the session list.
  const loaded = await loadFormSubmissions(actor);
  const sessions = await loadSessions(actor);
  const sessionChoices = sessions.ok ? sessions.value.map(s => ({ id: s.id, name: s.name })) : [];

  const actions = canManage && sessions.ok ? <NewRegistrationFormButton sessions={sessionChoices} /> : undefined;

  if (!loaded.ok) {
    return (
      <div className="page">
        <PageHeader title="Registration" actions={actions} />
        <Empty icon="alert" title="You cannot see registration forms" body={FORBIDDEN_REGISTRATION} />
      </div>
    );
  }
  const allRows = registrationSearchRows(loaded.value);
  const choices = knownSessions(sessions.ok ? sessions.value : [], allRows);
  const chosen = chosenSession(
    searchParams[SESSION_PARAM],
    choices,
    sessions.ok ? defaultSessionChoice(sessions.value) : ALL_SESSIONS,
  );
  // A chosen session is read again through the service, which keeps only the forms and registrations that ask for it.
  const shown = chosen === ALL_SESSIONS ? loaded : await loadFormSubmissions(actor, chosen);
  const shownEntries = shown.ok ? shown.value : [];
  // The session dropdown sits on the title line, before the New Form button, as on the Holds page.
  const sessionFilter =
    loaded.value.length > 0 && choices.length > 0 ? (
      <SessionFilter action={ROUTES.registration} sessions={choices} value={chosen} />
    ) : undefined;
  const headerActions =
    sessionFilter || actions ? (
      <>
        {sessionFilter}
        {actions}
      </>
    ) : undefined;

  return (
    <div className="page">
      <PageHeaderRow
        title="Registration"
        subtitle="Forms families fill in to register campers for sessions. Nothing is charged in this phase."
        controls={headerActions}
      />
      {loaded.value.length === 0 ? (
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
          {shownEntries.length === 0 ? (
            <Empty icon="list" title="No forms cover this session" body="Choose another session, or All sessions." />
          ) : (
            <>
              <FormsTable
                forms={shownEntries.map(entry => entry.form)}
                sessions={sessionChoices}
                canEdit={canManage && sessions.ok}
                canSubmit={can(actor, 'registration:submit')}
              />
              <section className="registration-section" aria-labelledby="registrations-list-heading">
                <h2 id="registrations-list-heading" className="people-subheading">
                  Registrations
                </h2>
                <RegistrationSearch
                  rows={registrationSearchRows(shownEntries).filter(row => inChosenSession(row.sessionId, chosen))}
                  canDelete={can(actor, 'registration:delete')}
                />
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

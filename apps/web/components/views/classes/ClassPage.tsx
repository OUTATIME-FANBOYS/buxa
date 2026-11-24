import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, isUuid } from '@buxa/domain';
import { ROUTES, assignPath, groupsPath } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components';
import { currentActor, loadPeopleWithRole, loadSessionPage } from '@buxa/server/composers/index.server';
import { FORBIDDEN_READ, resolveSessionTab, visibleSessionTabs } from '@buxa/shared';
import { SessionTabs } from '@/components/components/classes';
import { EditSessionButton, NewClassButton } from '@/components/components/classes/forms';
import { Button } from '@/components/elements';
import { ClassesTab } from './ClassesTab';
import { SessionHolds } from './SessionHolds';
import { SessionRegistrations } from './SessionRegistrations';

const pick = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && isUuid(value) ? value : null;

/**
 * One session's page: its name and actions, then three tabs. Classes is the default and holds the schedule (see ClassesTab).
 * Registrations and Holds need registration:read, the same read as the Registration and Holds screens; without it the tabs are not
 * shown and a URL that names one falls back to Classes. The tab is in the URL (`?tab=`).
 */
export async function ClassPage({
  classId: sessionId,
  searchParams,
}: {
  /** The session's id: the route segment keeps its historical name. */
  classId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const loaded = await loadSessionPage(actor, sessionId);
  if (!loaded.ok) {
    if (loaded.reason === 'not-found') {
      notFound();
    }

    return (
      <div className="page">
        <Empty icon="alert" title="You cannot see this session" body={FORBIDDEN_READ} />
      </div>
    );
  }

  const { session, classes } = loaded.value;
  const canManage = can(actor, 'classes:manage');
  const instructors = canManage ? await loadPeopleWithRole(actor, 'instructor') : null;
  const instructorChoices = instructors?.ok ? instructors.value.map(i => ({ id: i.id, name: i.name })) : [];
  const tabs = visibleSessionTabs(can(actor, 'registration:read'));
  const tab = resolveSessionTab(searchParams.tab, tabs);
  // The tab bodies are async, so they are awaited here rather than left as nested elements.
  const body =
    tab === 'registrations'
      ? await SessionRegistrations({ actor, sessionId: session.id, sessionName: session.name })
      : tab === 'holds'
        ? await SessionHolds({ actor, sessionId: session.id })
        : await ClassesTab({
            actor,
            session,
            classes,
            canManage,
            instructorChoices,
            selectedId: pick(searchParams.class),
          });

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="muted">
        <Link className="link" href={ROUTES.sessions}>
          Sessions
        </Link>{' '}
        / {session.name}
      </nav>
      <PageHeader
        title={session.name}
        subtitle={session.description || 'No description yet.'}
        actions={
          canManage && (
            <>
              <EditSessionButton
                session={session}
                canUnarchive={can(actor, 'org:update')}
                canPublish={can(actor, 'classes:publish')}
              />
              <Button variant="glass" size="sm" href={groupsPath(session.id)} icon="users">
                Groups and rooms
              </Button>
              <Button variant="glass" size="sm" href={assignPath(session.id)} icon="user-plus">
                Assign people
              </Button>
              <NewClassButton sessionId={session.id} sessionName={session.name} instructors={instructorChoices} />
            </>
          )
        }
      />

      {tabs.length > 1 && <SessionTabs sessionId={session.id} tabs={tabs} active={tab} />}

      {body}
    </div>
  );
}

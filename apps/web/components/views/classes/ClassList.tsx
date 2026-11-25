import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components';
import { currentActor } from '@buxa/server/composers/index.server';
import { FORBIDDEN_READ } from '@buxa/shared';
import { loadSessions } from '@buxa/server/composers/index.server';
import { DeletedSessionToast, SessionsTable } from '@/components/components/classes';
import { NewSessionButton } from '@/components/components/classes/forms';
import { Button } from '@/components/elements';

/**
 * The camp's sessions: each one a date range that holds classes. Anyone who can read classes sees them; only staff with
 * classes:manage see the create, import, edit and delete controls. `deletedName` is set when a session was just deleted (from
 * `?deleted=`), and shows a toast.
 */
export async function ClassList({ deletedName = null }: { deletedName?: string | null } = {}) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const canManage = can(actor, 'classes:manage');
  const loaded = await loadSessions(actor);

  const actions = canManage ? (
    <>
      <Button className="classes-target" icon="import" href={ROUTES.sessionImport}>
        Import classes
      </Button>
      <NewSessionButton />
    </>
  ) : undefined;

  return (
    <div className="page">
      <PageHeader
        title="Sessions"
        subtitle="The sessions the camp runs. Each session has a date range and holds its classes."
        actions={actions}
      />
      {!loaded.ok ? (
        <Empty icon="alert" title="You cannot see sessions" body={FORBIDDEN_READ} />
      ) : loaded.value.length === 0 ? (
        <Empty
          icon="calendar"
          title="No sessions yet"
          body={canManage ? 'Create the first session, then add its classes.' : 'Nobody has created a session yet.'}
          action={canManage && <NewSessionButton />}
        />
      ) : (
        <SessionsTable
          sessions={loaded.value}
          canManage={canManage}
          canUnarchive={can(actor, 'org:update')}
          canPublish={can(actor, 'classes:publish')}
        />
      )}
      {deletedName && <DeletedSessionToast name={deletedName} />}
    </div>
  );
}

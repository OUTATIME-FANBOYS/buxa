import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components/export';
import { currentActor } from '@buxa/server/composers/index.server';
import { FORBIDDEN_READ } from '@buxa/shared';
import { loadClasses } from '@buxa/server/composers/index.server';
import { ClassesTable } from '@/components/components/classes/export';
import { NewClassButton } from '@/components/components/classes/forms/export';
import { Button } from '@/components/elements/export';

/** The camp's classes. Anyone who can read classes sees them; only staff with classes:manage see the create and import buttons. */
export async function ClassList() {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const canManage = can(actor, 'classes:manage');
  const loaded = await loadClasses(actor);

  const actions = canManage ? (
    <>
      <Button className="classes-target" icon="import" href={ROUTES.classImport}>
        Import classes
      </Button>
      <NewClassButton />
    </>
  ) : undefined;

  return (
    <div className="page">
      <PageHeader
        title="Classes"
        subtitle="The programs the camp runs, and the sessions they are scheduled in."
        actions={actions}
      />
      {!loaded.ok ? (
        <Empty icon="alert" title="You cannot see classes" body={FORBIDDEN_READ} />
      ) : loaded.value.length === 0 ? (
        <Empty
          icon="calendar"
          title="No classes yet"
          body={canManage ? 'Create the first class, then add its sessions.' : 'Nobody has created a class yet.'}
          action={canManage && <NewClassButton />}
        />
      ) : (
        <ClassesTable classes={loaded.value} />
      )}
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { Empty, PageHeader } from '@/components/ui';
import { currentActor } from '@/features/people/lib/camp';
import { FORBIDDEN_READ } from '../lib/copy';
import { loadClasses } from '../lib/load';
import { ClassesTable } from '../components/ClassesTable';

/** The camp's classes. Anyone who can read classes sees them; only staff with classes:manage see the create and import buttons. */
export async function ClassList() {
  const actor = await currentActor();
  if (!actor) notFound();
  const canManage = can(actor, 'classes:manage');
  const loaded = await loadClasses(actor);

  const actions = canManage ? (
    <>
      <Link className="btn classes-target" href={ROUTES.classImport}>Import classes</Link>
      <Link className="btn btn-primary classes-target" href={ROUTES.newClass}>New class</Link>
    </>
  ) : undefined;

  return (
    <div className="page">
      <PageHeader title="Classes" subtitle="The programs the camp runs, and the sessions they are scheduled in." actions={actions} />
      {!loaded.ok ? (
        <Empty icon="alert" title="You cannot see classes" body={FORBIDDEN_READ} />
      ) : loaded.value.length === 0 ? (
        <Empty icon="calendar" title="No classes yet"
          body={canManage ? 'Create the first class, then add its sessions.' : 'Nobody has created a class yet.'}
          action={canManage && <Link className="btn btn-primary classes-target" href={ROUTES.newClass}>New class</Link>} />
      ) : (
        <ClassesTable classes={loaded.value} />
      )}
    </div>
  );
}

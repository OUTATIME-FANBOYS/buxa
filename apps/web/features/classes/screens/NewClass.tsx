import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { Empty, PageHeader } from '@/components/ui';
import { currentActor } from '@/features/people/lib/camp';
import { FORBIDDEN_MANAGE } from '../lib/copy';
import { NewClassForm } from '../forms/NewClassForm';

/** Create a class. Viewers get the forbidden state and no form. */
export async function NewClass() {
  const actor = await currentActor();
  if (!actor) notFound();
  const allowed = can(actor, 'classes:manage');
  return (
    <div className="page">
      <PageHeader title="New class" subtitle="A class is a program. Its sessions are added after it is saved." />
      {allowed ? <NewClassForm /> : (
        <Empty icon="alert" title="You cannot create classes" body={FORBIDDEN_MANAGE}
          action={<Link className="btn classes-target" href={ROUTES.classes}>Back to classes</Link>} />
      )}
    </div>
  );
}

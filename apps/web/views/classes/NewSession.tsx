import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { classPath } from '@/config/routes';
import { Empty, PageHeader } from '@/components';
import { currentActor } from '@/logic/composers/index.server';
import { campZone } from '@/logic/composers/index.server';
import { FORBIDDEN_MANAGE } from '@/logic/common';
import { loadClassPage, loadPeopleWithRole } from '@/logic/composers/index.server';
import { NewSessionForm } from '@/components';

/** Add a session to one class. Viewers get the forbidden state and no form; an unknown class is not found. */
export async function NewSession({ classId }: { classId: string }) {
  const actor = await currentActor();
  if (!actor) notFound();
  if (!can(actor, 'classes:manage')) {
    return (
      <div className="page">
        <Empty icon="alert" title="You cannot add sessions" body={FORBIDDEN_MANAGE}
          action={<Link className="btn classes-target" href={classPath(classId)}>Back to the class</Link>} />
      </div>
    );
  }

  const loaded = await loadClassPage(actor, classId);
  if (!loaded.ok) notFound();
  const { cls } = loaded.value;
  const timeZone = await campZone(actor);
  const instructors = await loadPeopleWithRole(actor, 'instructor');

  return (
    <div className="page">
      <PageHeader title="Add session" subtitle={`A new session of ${cls.name}.`} />
      <NewSessionForm
        classId={cls.id}
        className={cls.name}
        defaultCapacity={cls.capacity}
        timeZone={timeZone}
        ratio={cls.instructorRatio}
        instructors={instructors.ok ? instructors.value.map(i => ({ id: i.id, name: i.name })) : []}
      />
    </div>
  );
}

import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { classPath } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components/export';
import { currentActor } from '@buxa/server/composers/index.server';
import { campZone } from '@buxa/server/composers/index.server';
import { FORBIDDEN_MANAGE } from '@buxa/shared';
import { loadClassPage, loadPeopleWithRole } from '@buxa/server/composers/index.server';
import { NewSessionForm } from '@/components/components/classes/forms/export';
import { Button } from '@/components/elements/export';

/** Add a session to one class. Viewers get the forbidden state and no form; an unknown class is not found. */
export async function NewSession({ classId }: { classId: string }) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  if (!can(actor, 'classes:manage')) {
    return (
      <div className="page">
        <Empty
          icon="alert"
          title="You cannot add sessions"
          body={FORBIDDEN_MANAGE}
          action={
            <Button className="classes-target" href={classPath(classId)}>
              Back to the class
            </Button>
          }
        />
      </div>
    );
  }

  const loaded = await loadClassPage(actor, classId);
  if (!loaded.ok) {
    notFound();
  }
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

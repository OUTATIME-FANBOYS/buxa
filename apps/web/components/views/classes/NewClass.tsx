import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { classPath } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components';
import { currentActor } from '@buxa/server/composers/index.server';
import { campZone } from '@buxa/server/composers/index.server';
import { FORBIDDEN_MANAGE } from '@buxa/shared';
import { loadSessionPage, loadPeopleWithRole } from '@buxa/server/composers/index.server';
import { ClassForm } from '@/components/components/classes/forms';
import { Button } from '@/components/elements';

/** Add a class to one session (its time range, ages, camp size and location). Viewers get the forbidden state; an unknown session is not found. */
export async function NewClass({ sessionId }: { sessionId: string }) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  if (!can(actor, 'classes:manage')) {
    return (
      <div className="page">
        <Empty
          icon="alert"
          title="You cannot add classes"
          body={FORBIDDEN_MANAGE}
          action={
            <Button className="classes-target" href={classPath(sessionId)}>
              Back to the session
            </Button>
          }
        />
      </div>
    );
  }

  const loaded = await loadSessionPage(actor, sessionId);
  if (!loaded.ok) {
    notFound();
  }
  const { session } = loaded.value;
  const timeZone = await campZone(actor);
  const instructors = await loadPeopleWithRole(actor, 'instructor');

  return (
    <div className="page">
      <PageHeader title="New class" subtitle={`A new class in ${session.name}.`} />
      <ClassForm
        sessionId={session.id}
        sessionName={session.name}
        timeZone={timeZone}
        instructors={instructors.ok ? instructors.value.map(i => ({ id: i.id, name: i.name })) : []}
      />
    </div>
  );
}

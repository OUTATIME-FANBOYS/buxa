import { ROUTES } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components';
import { currentActor } from '@buxa/server/composers/index.server';
import { can } from '@buxa/domain';
import { FORBIDDEN_MANAGE } from '@buxa/shared';
import { NewSessionForm } from '@/components/components/classes/forms';
import { Button } from '@/components/elements';
import { notFound } from 'next/navigation';

/** Create a session (its date range). Viewers get the forbidden state and no form. The Sessions page opens the same form in a dialog. */
export async function NewSession() {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  if (!can(actor, 'classes:manage')) {
    return (
      <div className="page">
        <Empty
          icon="alert"
          title="You cannot create sessions"
          body={FORBIDDEN_MANAGE}
          action={
            <Button className="classes-target" href={ROUTES.classes}>
              Back to sessions
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="New session" subtitle="A session is a date range. Its classes are added after it is saved." />
      <NewSessionForm />
    </div>
  );
}

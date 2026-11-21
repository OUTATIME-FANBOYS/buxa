import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { personPath } from '@/config/routes';
import { Empty } from '@/components/components';
import { PageHeader } from '@/components/components';
import { EditPersonForm } from '@/components/components/people/forms';
import { currentActor } from '@buxa/server/composers/index.server';
import { displayName } from '@buxa/shared';
import { loadPerson } from '@buxa/server/composers/index.server';
import { Button } from '@/components/elements';

/** Change one person's details. Only people:update may; everyone else is told so, without a form to fill in. */
export async function EditPerson({ id }: { id: string }) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const person = await loadPerson(actor, id);
  if (!person) {
    notFound();
  }

  if (!can(actor, 'people:update')) {
    return (
      <div className="page">
        <PageHeader title="Edit person" />
        <Empty
          icon="alert"
          title="Your role cannot change people's details"
          body="Ask a staff member or admin to make the change."
          action={<Button href={personPath(person.id)}>Back to {displayName(person)}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="page narrow">
      <PageHeader
        title="Edit person"
        subtitle={`${displayName(person)}. Changes are saved to the camp record and shown to everyone who can see this person.`}
      />
      <EditPersonForm person={person} />
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { personPath } from '@/config/routes';
import { Empty } from '@/components/ui';
import { PageHeader } from '../components/PageHeader';
import { EditPersonForm } from '../forms/EditPersonForm';
import { currentActor } from '../lib/camp';
import { displayName } from '../lib/format';
import { loadPerson } from '../lib/loadPerson';

/** Change one person's details. Only people:update may; everyone else is told so, without a form to fill in. */
export async function EditPerson({ id }: { id: string }) {
  const actor = await currentActor();
  if (!actor) notFound();
  const person = await loadPerson(actor, id);
  if (!person) notFound();

  if (!can(actor, 'people:update')) {
    return (
      <div className="page">
        <PageHeader title="Edit person" />
        <Empty icon="alert" title="Your role cannot change people's details" body="Ask a staff member or admin to make the change."
          action={<Link className="btn" href={personPath(person.id)}>Back to {displayName(person)}</Link>} />
      </div>
    );
  }

  return (
    <div className="page narrow">
      <PageHeader title={`Edit ${displayName(person)}`} subtitle="Changes are saved to the camp record and shown to everyone who can see this person." />
      <EditPersonForm person={person} />
    </div>
  );
}

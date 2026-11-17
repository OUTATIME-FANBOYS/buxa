import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, isUuid } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { Empty } from '@/components/components/export';
import { loadHouseholdList } from '@buxa/server/composers/index.server';
import { PageHeader } from '@/components/components/export';
import { NewPersonForm } from '@/components/components/people/forms/export';
import { currentActor } from '@buxa/server/composers/index.server';
import { loadHousehold } from '@buxa/server/composers/index.server';
import { toHouseholdChoices } from '@buxa/shared';

/**
 * Add a person. `household` (a household id in the address) comes from a guardian's page, so adding a child to a family is one step.
 * Without one, the form offers every household in the camp, or a new household for a guardian.
 */
export async function NewPerson({ householdId }: { householdId?: string }) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  if (!can(actor, 'people:create')) {
    return (
      <div className="page">
        <PageHeader title="Add person" />
        <Empty icon="alert" title="Your role cannot add people" body="Ask a staff member or admin to add them." action={<Link className="btn" href={ROUTES.people}>Back to people</Link>} />
      </div>
    );
  }
  const household = isUuid(householdId) ? await loadHousehold(actor, householdId) : null;
  const choices = household ? [] : toHouseholdChoices(await loadHouseholdList(actor));

  return (
    <div className="page narrow">
      <PageHeader title="Add person"
        subtitle={household ? `Adding to the ${household.name} household.` : 'A child must join a household that has a parent or guardian in it.'} />
      <NewPersonForm household={household ? { id: household.id, name: household.name } : null} households={choices} />
    </div>
  );
}

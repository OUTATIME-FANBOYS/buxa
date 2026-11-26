import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, isTeachingView } from '@buxa/domain';
import { peopleTabPath } from '@/config/routes';
import { currentActor, loadHousehold, loadPersonMatches } from '@buxa/server/composers/index.server';
import { readListParams } from '@buxa/shared';
import { HouseholdEditor } from '@/components/components/people';

/**
 * One household: its name, its members with their roles, and every edit to it. The server checks each action again; a viewer sees the
 * members and no controls. A household that is not in this camp is not found.
 */
export async function HouseholdScreen({
  householdId,
  searchParams = {},
}: {
  householdId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const actor = await currentActor();
  if (!actor || isTeachingView(actor) || !can(actor, 'people:read')) {
    notFound();
  }
  const household = await loadHousehold(actor, householdId);
  if (!household) {
    notFound();
  }

  const canUpdate = can(actor, 'people:update');
  const { q } = readListParams(searchParams);
  // The name search for someone to link in. Only staff who may update the household search, and the service caps the matches.
  const matches = canUpdate && q !== '' ? await loadPersonMatches(actor, q) : [];
  const linkable = matches.map(p => ({ id: p.id, name: `${p.givenName} ${p.familyName}` }));
  const count = household.members.length;

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="muted">
        <Link className="link" href={peopleTabPath('households')}>
          Households
        </Link>{' '}
        / {household.name}
      </nav>
      <header className="page-head">
        <div className="page-title">
          <h1>{household.name}</h1>
          <p className="muted">{count === 1 ? '1 member' : `${count} members`}</p>
        </div>
      </header>
      <HouseholdEditor
        household={household}
        canUpdate={canUpdate}
        canCreate={can(actor, 'people:create')}
        canAuthorisePickup={can(actor, 'people:authorise_pickup')}
        query={q}
        linkable={linkable}
      />
    </div>
  );
}

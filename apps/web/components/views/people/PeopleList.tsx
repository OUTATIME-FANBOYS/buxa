import { notFound } from 'next/navigation';
import { can, isTeachingView } from '@buxa/domain';
import { Empty } from '@/components/components';
import { loadHouseholdList, loadPeoplePageOrForbidden } from '@buxa/server/composers/index.server';
import { currentActor } from '@buxa/server/composers/index.server';
import { readListParams, resolvePeopleTab, toHouseholdChoices } from '@buxa/shared';
import { HouseholdDirectory, PeoplePagination, PeopleTabs } from '@/components/components/people';
import { PeopleSearch } from '@/components/components/people';
import { PeopleTable } from '@/components/components/people';
import { AddPersonButton } from '@/components/components/people/forms';
import type { Actor } from '@buxa/domain';
import type { ListParams } from '@buxa/shared';

const countLine = (n: number) => (n === 1 ? '1 person' : `${n} people`);

/**
 * The People page, on two tabs (`?tab=people|households`). People is the list with search, role filter and pages; viewers see names,
 * roles and status, and only staff and above see the add button. Households lists every household with its members; it has no add
 * button, and each household is edited on its own page.
 */
export async function PeopleList({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const actor = await currentActor();
  // The teaching view has no People list: the sidebar hides it, and the address does not open it either.
  if (!actor || isTeachingView(actor)) {
    notFound();
  }
  const tab = resolvePeopleTab(searchParams.tab);
  const params = readListParams(searchParams);
  const canAdd = can(actor, 'people:create');
  const canEdit = can(actor, 'people:update');
  // The header button and the Add pop-up's household picker only appear on the People tab.
  const households = tab === 'people' && (canAdd || canEdit) ? toHouseholdChoices(await loadHouseholdList(actor)) : [];
  // ?add=person opens the Add person pop-up on the People tab (the link from a registration form); ?household= joins it to that family.
  const addOpen = canAdd && tab === 'people' && searchParams.add === 'person';
  const householdId = typeof searchParams.household === 'string' ? searchParams.household : undefined;

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title">
          <h1>People</h1>
          <p className="muted">Children, families, instructors and staff who belong to the camp.</p>
        </div>
        {canAdd && tab === 'people' && (
          <div className="page-actions">
            <AddPersonButton households={households} initialOpen={addOpen} householdId={householdId} />
          </div>
        )}
      </header>
      <PeopleTabs active={tab} />
      {tab === 'households' ? (
        <HouseholdsTab actor={actor} query={params.q} />
      ) : (
        <PeopleListTab actor={actor} params={params} canAdd={canAdd} canEdit={canEdit} households={households} />
      )}
    </div>
  );
}

async function PeopleListTab({
  actor,
  params,
  canAdd,
  canEdit,
  households,
}: {
  actor: Actor;
  params: ListParams;
  canAdd: boolean;
  canEdit: boolean;
  households: ReturnType<typeof toHouseholdChoices>;
}) {
  const result = await listFor(actor, params);
  const filtered = params.q !== '' || params.role !== '';

  return (
    <>
      <PeopleSearch params={params} />
      {result === 'forbidden' ? (
        <Empty
          icon="alert"
          title="You cannot see the people list"
          body="Ask an admin if you need to see people in this camp."
        />
      ) : (
        <div aria-live="polite" className="stack">
          {result.total === 0 ? (
            filtered ? (
              <Empty icon="search" title="No one matches that search" body="Check the spelling, or try another role." />
            ) : (
              <Empty
                icon="users"
                title="No people yet"
                body={
                  canAdd
                    ? 'Add the first child, parent or staff member to start the camp list.'
                    : 'Nobody has been added to the camp yet.'
                }
                action={canAdd && <AddPersonButton households={households} />}
              />
            )
          ) : (
            <>
              <p className="muted">{countLine(result.total)}</p>
              <PeopleTable
                people={result.people}
                staffView={can(actor, 'people:read_contact')}
                canEdit={canEdit}
                households={households}
                canDelete={can(actor, 'data:erase')}
              />
              <PeoplePagination
                params={params}
                page={result.page}
                pageCount={result.pageCount}
                from={result.from}
                to={result.to}
                total={result.total}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

async function HouseholdsTab({ actor, query }: { actor: Actor; query: string }) {
  if (!can(actor, 'people:read')) {
    return (
      <Empty
        icon="alert"
        title="You cannot see households"
        body="Ask an admin if you need to see the households in this camp."
      />
    );
  }
  const households = await loadHouseholdList(actor);

  return <HouseholdDirectory households={households} query={query} />;
}

async function listFor(actor: Actor, params: ListParams) {
  return loadPeoplePageOrForbidden(actor, params);
}

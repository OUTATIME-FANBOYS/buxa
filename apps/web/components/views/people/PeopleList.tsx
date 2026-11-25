import { notFound } from 'next/navigation';
import { can, isTeachingView } from '@buxa/domain';
import { Empty } from '@/components/components';
import { loadHouseholdList, loadPeoplePageOrForbidden } from '@buxa/server/composers/index.server';
import { currentActor } from '@buxa/server/composers/index.server';
import { readListParams, toHouseholdChoices } from '@buxa/shared';
import { PeoplePagination } from '@/components/components/people';
import { PeopleSearch } from '@/components/components/people';
import { PeopleTable } from '@/components/components/people';
import { AddPersonButton } from '@/components/components/people/forms';
import type { Actor } from '@buxa/domain';
import type { ListParams } from '@buxa/shared';

const countLine = (n: number) => (n === 1 ? '1 person' : `${n} people`);

/** The people list with search, role filter and pages. Viewers see names, roles and status; only staff and above see the add button. */
export async function PeopleList({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const actor = await currentActor();
  // The teaching view has no People list: the sidebar hides it, and the address does not open it either.
  if (!actor || isTeachingView(actor)) {
    notFound();
  }
  const params = readListParams(searchParams);
  const canAdd = can(actor, 'people:create');
  const canEdit = can(actor, 'people:update');
  const result = await listFor(actor, params);
  const filtered = params.q !== '' || params.role !== '';
  // The household pickers in the Add and Edit pop-ups. Only staff who can add or edit people load the list.
  const households = canAdd || canEdit ? toHouseholdChoices(await loadHouseholdList(actor)) : [];

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title">
          <h1>People</h1>
          <p className="muted">Children, families, instructors and staff who belong to the camp.</p>
        </div>
        {canAdd && (
          <div className="page-actions">
            <AddPersonButton households={households} />
          </div>
        )}
      </header>
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
    </div>
  );
}

async function listFor(actor: Actor, params: ListParams) {
  return loadPeoplePageOrForbidden(actor, params);
}

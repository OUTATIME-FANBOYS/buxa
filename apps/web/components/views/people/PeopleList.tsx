import { notFound } from 'next/navigation';
import { can, settle } from '@buxa/domain';
import { Empty } from '@/components/components/export';
import { loadHouseholdList, loadPeopleOrForbidden } from '@buxa/server/composers/index.server';
import { currentActor } from '@buxa/server/composers/index.server';
import { readListParams, toHouseholdChoices, type ListParams } from '@buxa/shared';
import { PeopleSearch } from '@/components/components/people/export';
import { PeopleTable } from '@/components/components/people/export';
import { AddPersonButton } from '@/components/components/people/forms/export';
import type { PersonSummary } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';

const countLine = (n: number) => (n === 1 ? '1 person' : `${n} people`);

function listFor(actor: Actor, params: ListParams): Promise<PersonSummary[] | 'forbidden'> {
  return settle(() => {
    return loadPeopleOrForbidden(actor, params);
  });
}

/** The people list with search and role filter. Viewers see names, roles and status; only staff and above see the add button. */
export async function PeopleList({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const params = readListParams(searchParams);
  const canAdd = can(actor, 'people:create');
  const people = await listFor(actor, params);
  const filtered = params.q !== '' || params.role !== '';
  // The add dialog's household picker. Only staff who can add people load the list.
  const households = canAdd ? toHouseholdChoices(await loadHouseholdList(actor)) : [];

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title"><h1>People</h1><p className="muted">Children, families, instructors and staff who belong to the camp.</p></div>
        {canAdd && <div className="page-actions"><AddPersonButton households={households} /></div>}
      </header>
      <PeopleSearch params={params} />
      {people === 'forbidden' ? (
        <Empty icon="alert" title="You cannot see the people list" body="Ask an admin if you need to see people in this camp." />
      ) : (
        <div aria-live="polite" className="stack">
          {people.length === 0 ? (
            filtered
              ? <Empty icon="search" title="No one matches that search" body="Check the spelling, or try another role." />
              : <Empty icon="users" title="No people yet" body={canAdd ? 'Add the first child, parent or staff member to start the camp list.' : 'Nobody has been added to the camp yet.'}
                action={canAdd && <AddPersonButton households={households} />} />
          ) : (
            <>
              <p className="muted">{countLine(people.length)}</p>
              <PeopleTable people={people} staffView={can(actor, 'people:read_contact')} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

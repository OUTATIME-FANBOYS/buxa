import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { Empty } from '@/components/ui';
import { isHttpError } from '@/server/http/errors';
import { getRuntime } from '@/server/runtime';
import { currentActor } from '../lib/camp';
import { readListParams, toListQuery, type ListParams } from '../lib/listQuery';
import { PeopleSearch } from '../components/PeopleSearch';
import { PeopleTable } from '../components/PeopleTable';
import type { PersonSummary } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';

const countLine = (n: number) => (n === 1 ? '1 person' : `${n} people`);

async function listFor(actor: Actor, params: ListParams): Promise<PersonSummary[] | 'forbidden'> {
  try { return await getRuntime().services.people.list(actor, toListQuery(params)); }
  catch (error) {
    if (isHttpError(error) && error.statusCode === 403) return 'forbidden';
    throw error; // anything else goes to the camp error boundary
  }
}

/** The people list with search and role filter. Viewers see names, roles and status; only staff and above see the add button. */
export async function PeopleList({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const actor = await currentActor();
  if (!actor) notFound();
  const params = readListParams(searchParams);
  const canAdd = can(actor, 'people:create');
  const people = await listFor(actor, params);
  const filtered = params.q !== '' || params.role !== '';

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title"><h1>People</h1><p className="muted">Children, families, instructors and staff who belong to the camp.</p></div>
        {canAdd && <div className="page-actions"><Link className="btn btn-primary" href={ROUTES.newPerson}>Add person</Link></div>}
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
                  action={canAdd && <Link className="btn btn-primary" href={ROUTES.newPerson}>Add person</Link>} />
          ) : (
            <>
              <p className="muted">{countLine(people.length)}</p>
              <PeopleTable people={people} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

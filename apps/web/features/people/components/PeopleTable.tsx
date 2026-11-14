import Link from 'next/link';
import type { PersonSummary } from '@buxa/contracts';
import { personPath } from '@/config/routes';
import { AccessPill } from './AccessPill';
import { OnSitePill } from './OnSitePill';
import { RolePills } from './RolePills';

export function PeopleTable({ people }: { people: readonly PersonSummary[] }) {
  return (
    <div className="table-wrap"><table className="table">
      <caption className="sr-only">People in the camp</caption>
      <thead><tr><th scope="col">Name</th><th scope="col">Roles</th><th scope="col">Membership</th><th scope="col">On site</th></tr></thead>
      <tbody>
        {people.map(person => (
          <tr key={person.id}>
            <td><Link className="row-title" href={personPath(person.id)}>
              {person.givenName} {person.familyName}{person.preferredName ? ` (${person.preferredName})` : ''}
            </Link></td>
            <td><RolePills roles={person.roles} /></td>
            <td><AccessPill status={person.status} /></td>
            <td><OnSitePill onSite={person.onSite} /></td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

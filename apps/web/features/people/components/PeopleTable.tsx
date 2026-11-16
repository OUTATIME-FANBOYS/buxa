import Link from 'next/link';
import type { PersonSummary } from '@buxa/contracts';
import { personPath } from '../../../config/routes';
import { AccessPill } from './AccessPill';
import { OnSitePill } from './OnSitePill';
import { RolePills } from './RolePills';

/** The membership and on-site columns are for staff; viewers see names and roles only. */
export function PeopleTable({ people, staffView }: { people: readonly PersonSummary[]; staffView: boolean }) {
  return (
    <div className="table-wrap"><table className="table">
      <caption className="sr-only">People in the camp</caption>
      <thead><tr><th scope="col">Name</th><th scope="col">Roles</th>{staffView && <th scope="col">Membership</th>}{staffView && <th scope="col">On site</th>}</tr></thead>
      <tbody>
        {people.map(person => (
          <tr key={person.id}>
            <td><Link className="row-title" href={personPath(person.id)}>
              {person.givenName} {person.familyName}{person.preferredName ? ` (${person.preferredName})` : ''}
            </Link></td>
            <td><RolePills roles={person.roles} /></td>
            {staffView && <td><AccessPill status={person.status} /></td>}
            {staffView && <td><OnSitePill onSite={person.onSite} /></td>}
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

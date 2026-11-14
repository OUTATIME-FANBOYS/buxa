import { CAMP_ROLES, CAMP_ROLE_LABELS } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import type { ListParams } from '../lib/listQuery';

/** A plain GET form: works without JavaScript, and the search is bookmarkable (`?q=` and `?role=`). */
export function PeopleSearch({ params }: { params: ListParams }) {
  return (
    <form role="search" method="get" action={ROUTES.people} className="row">
      <label className="field">
        <span className="field-label">Search by name</span>
        <input type="search" name="q" defaultValue={params.q} maxLength={80} autoComplete="off" />
      </label>
      <label className="field">
        <span className="field-label">Role</span>
        <select name="role" defaultValue={params.role}>
          <option value="">All roles</option>
          {CAMP_ROLES.map(role => <option key={role} value={role}>{CAMP_ROLE_LABELS[role]}</option>)}
        </select>
      </label>
      <button className="btn" type="submit">Search</button>
    </form>
  );
}

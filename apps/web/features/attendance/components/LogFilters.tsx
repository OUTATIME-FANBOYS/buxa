import type { PersonSummary } from '@buxa/contracts';
import { ROUTES } from '@/config/routes';
import { displayName } from '../lib/name';

export interface LogFilterValues { from: string; to: string; personId: string }

/** The log's date range and person filter. A plain GET form, so it works without scripts and the address is shareable. */
export function LogFilters({ values, people }: { values: LogFilterValues; people: readonly PersonSummary[] }) {
  return (
    <form className="log-filters" method="get" action={ROUTES.attendance} role="search" aria-label="Filter the log">
      <label className="field">
        <span className="field-label">From</span>
        <input type="date" name="from" defaultValue={values.from} required />
      </label>
      <label className="field">
        <span className="field-label">To</span>
        <input type="date" name="to" defaultValue={values.to} required />
      </label>
      <label className="field">
        <span className="field-label">Person</span>
        <select name="personId" defaultValue={values.personId}>
          <option value="">Everyone</option>
          {people.map(person => <option key={person.id} value={person.id}>{displayName(person)}</option>)}
        </select>
      </label>
      <button type="submit" className="btn btn-primary att-btn-lg">Show</button>
    </form>
  );
}

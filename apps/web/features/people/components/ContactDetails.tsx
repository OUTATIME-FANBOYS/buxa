import type { Person } from '@buxa/contracts';
import { formatLocalDate } from '../lib/format';

/**
 * Date of birth, email and phone. The server sends null for what this role may not see, and for what was never recorded: a null row
 * is left out entirely, so nothing is ever shown as "null" or as an empty label.
 */
export function ContactDetails({ person }: { person: Pick<Person, 'dateOfBirth' | 'email' | 'phone' | 'isMinor'> }) {
  const rows: { label: string; value: string }[] = [];
  if (person.dateOfBirth) rows.push({ label: 'Date of birth', value: `${formatLocalDate(person.dateOfBirth)}${person.isMinor === true ? ' (under 18)' : ''}` });
  if (person.email) rows.push({ label: 'Email', value: person.email });
  if (person.phone) rows.push({ label: 'Phone', value: person.phone });
  if (rows.length === 0) return null;

  return (
    <dl className="people-facts">
      {rows.map(row => (
        <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
      ))}
    </dl>
  );
}

import type { ReactNode } from 'react';
import type { PersonSummary } from '@buxa/contracts';
import { ROUTES } from '@/config/routes';
import { attendanceDisplayName } from '@buxa/shared';
import { Button, DatePicker, parseLocalDate, Select } from '@/components/atoms';

interface LogFilterValues {
  from: string;
  to: string;
  personId: string;
}

/** The log's date range and person filter. A plain GET form, so it works without scripts and the address is shareable. */
export function LogFilters({
  values,
  people,
  children,
}: {
  values: LogFilterValues;
  people: readonly PersonSummary[];
  children?: ReactNode;
}) {
  return (
    <form
      className="form-row log-filters"
      method="get"
      action={ROUTES.attendance}
      role="search"
      aria-label="Filter the log"
    >
      <DatePicker label="From" name="from" defaultValue={parseLocalDate(values.from)} isRequired />
      <DatePicker label="To" name="to" defaultValue={parseLocalDate(values.to)} isRequired />
      <Select
        label="Person"
        name="personId"
        defaultValue={values.personId}
        options={[
          { value: '', label: 'Everyone' },
          ...people.map(person => ({ value: person.id, label: attendanceDisplayName(person) })),
        ]}
      />
      <Button variant="primary" type="submit">
        Show
      </Button>
      {children}
    </form>
  );
}

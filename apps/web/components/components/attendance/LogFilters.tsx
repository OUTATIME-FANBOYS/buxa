import type { ReactNode } from 'react';
import Form from 'next/form';
import type { PersonSummary } from '@buxa/contracts';
import { ROUTES } from '@/config/routes';
import { attendanceDisplayName } from '@buxa/shared';
import { Button, DatePicker, Select } from '@/components/atoms';

interface LogFilterValues {
  from: string;
  to: string;
  personId: string;
}

/**
 * The log's date range and person filter. A GET form (so the address is shareable and works without scripts). next/form navigates
 * on the client, so "Show" swaps in the new rows without reloading the whole page, as PeopleSearch does.
 */
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
    <Form
      className="form-row log-filters buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-end buxa:[&>.field]:flex-[1_1_180px] buxa:[&>.field]:min-w-0 buxa:[&>.button]:flex-none buxa:[&>a.button]:flex-none"
      action={ROUTES.attendance}
      role="search"
      aria-label="Filter the log"
    >
      <DatePicker label="From" name="from" defaultValue={values.from} isRequired />
      <DatePicker label="To" name="to" defaultValue={values.to} isRequired />
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
    </Form>
  );
}

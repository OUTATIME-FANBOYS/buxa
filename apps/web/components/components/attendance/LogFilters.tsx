'use client';

import { useState, type ReactNode } from 'react';
import Form from 'next/form';
import type { PersonSummary } from '@buxa/contracts';
import { ROUTES } from '@/config/routes';
import {
  attendanceDisplayName,
  classAfterSessionChange,
  classesOfSession,
  METHOD_LABEL,
  type LogFilterChoices,
} from '@buxa/shared';
import { Button, DatePicker, Select } from '@/components/atoms';

export interface LogFilterValues {
  from: string;
  to: string;
  personId: string;
  sessionId: string;
  classId: string;
  method: string;
  checkedInBy: string;
  status: string;
}

/**
 * The log's filters: the date range (required), then the person, session, class, method, staff member and status. They combine.
 * A GET form (so the address is shareable and works without scripts). next/form navigates on the client, so "Show" swaps in the
 * new rows without reloading the whole page. The class list follows the chosen session: a class from another session is cleared.
 */
export function LogFilters({
  values,
  people,
  choices,
  children,
}: {
  values: LogFilterValues;
  people: readonly PersonSummary[];
  choices: LogFilterChoices;
  children?: ReactNode;
}) {
  const [sessionId, setSessionId] = useState(values.sessionId);
  const [classId, setClassId] = useState(values.classId);
  const classOptions = classesOfSession(choices.classes, sessionId);

  const chooseSession = (next: string | null) => {
    const id = next ?? '';
    setSessionId(id);
    setClassId(classAfterSessionChange(classId, choices.classes, id));
  };

  return (
    <Form className="form-row log-filters" action={ROUTES.attendance} role="search" aria-label="Filter the log">
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
      <Select
        label="Session"
        name="sessionId"
        value={sessionId}
        onChange={chooseSession}
        options={[
          { value: '', label: 'All sessions' },
          ...choices.sessions.map(session => ({ value: session.id, label: session.name })),
        ]}
      />
      <Select
        label="Class"
        name="classId"
        value={classId}
        onChange={next => setClassId(next ?? '')}
        options={[
          { value: '', label: 'All classes' },
          ...classOptions.map(cls => ({ value: cls.id, label: cls.name })),
        ]}
      />
      <Select
        label="Method"
        name="method"
        defaultValue={values.method}
        options={[
          { value: '', label: 'Any method' },
          { value: 'qr', label: METHOD_LABEL.qr },
          { value: 'manual', label: METHOD_LABEL.manual },
        ]}
      />
      <Select
        label="Checked in by"
        name="checkedInBy"
        defaultValue={values.checkedInBy}
        options={[
          { value: '', label: 'Anyone' },
          ...choices.staff.map(member => ({ value: member.id, label: member.name })),
        ]}
      />
      <Select
        label="Status"
        name="status"
        defaultValue={values.status}
        options={[
          { value: '', label: 'All' },
          { value: 'on_site', label: 'Still on site' },
          { value: 'checked_out', label: 'Checked out' },
        ]}
      />
      <Button variant="primary" type="submit">
        Show
      </Button>
      {children}
    </Form>
  );
}

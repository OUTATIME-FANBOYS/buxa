'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Checkbox, SearchField } from '@/components/atoms';
import { Empty } from '@/components/components';
import { Pill } from '@/components/elements';
import { sessionTabPath } from '@/config/routes';
import { RegistrationActions } from './RegistrationActions';
import type { RegistrationSearchRow } from './registrationSearchRows';

const STATUS: Record<RegistrationSearchRow['status'], { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
  confirmed: { label: 'Confirmed', tone: 'ok' },
  pending: { label: 'Pending', tone: 'warn' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

/**
 * Every registration in the camp, across all sessions, with a search box for the camper, the form or the session. Each row links to
 * its session's Registrations tab, where the family's places and payments are.
 */
export function RegistrationSearch({
  rows,
  canDelete = false,
}: {
  rows: readonly RegistrationSearchRow[];
  /** Whether the person may delete a registration (an admin or the owner). */
  canDelete?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const needle = query.trim().toLowerCase();
  // An archived registration is kept but hidden from the list until asked for.
  const visible = showArchived ? rows : rows.filter(row => !row.archived);
  const shown = needle
    ? visible.filter(row => [row.camperName, row.formName, row.sessionName].some(v => v.toLowerCase().includes(needle)))
    : visible;

  return (
    <div className="stack">
      <SearchField
        aria-label="Search registrations"
        placeholder="Search by camper, form or session"
        value={query}
        onChange={setQuery}
      />
      {rows.some(row => row.archived) && (
        <Checkbox isSelected={showArchived} onChange={setShowArchived}>
          Show archived registrations
        </Checkbox>
      )}
      {rows.length === 0 ? (
        <Empty
          icon="list"
          title="No registrations yet"
          body="Registrations appear here once a family has been registered."
        />
      ) : visible.length === 0 ? (
        <Empty
          icon="list"
          title="No registrations to show"
          body="Every registration is archived. Show archived registrations to see them."
        />
      ) : shown.length === 0 ? (
        <Empty icon="search" title="No registrations match" body="Try another name, form or session." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Registrations across every session, with a link to each session</caption>
            <thead>
              <tr>
                <th scope="col">Camper</th>
                <th scope="col">Form</th>
                <th scope="col">Session</th>
                <th scope="col">Status</th>
                <th scope="col">Submitted</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(row => (
                <tr key={row.id}>
                  <td>{row.camperName}</td>
                  <td>{row.formName}</td>
                  <td>
                    <Link className="link" href={sessionTabPath(row.sessionId, 'registrations')}>
                      {row.sessionName}
                    </Link>
                  </td>
                  <td>
                    <Pill tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Pill>
                    {row.archived && (
                      <Pill tone="neutral" dot={false}>
                        Archived
                      </Pill>
                    )}
                  </td>
                  <td>{row.submitted}</td>
                  <td>
                    <RegistrationActions
                      formId={row.formId}
                      registrationId={row.registrationId}
                      status={row.status}
                      archived={row.archived}
                      canDelete={canDelete}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

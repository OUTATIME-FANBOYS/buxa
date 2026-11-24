'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SearchField } from '@/components/atoms';
import { Empty } from '@/components/components';
import { Pill } from '@/components/elements';
import { sessionTabPath } from '@/config/routes';
import type { RegistrationSearchRow } from './registrationSearchRows';

const STATUS: Record<RegistrationSearchRow['status'], { label: string; tone: 'ok' | 'warn' }> = {
  confirmed: { label: 'Confirmed', tone: 'ok' },
  pending: { label: 'Pending', tone: 'warn' },
};

/**
 * Every registration in the camp, across all sessions, with a search box for the camper, the form or the session. Each row links to
 * its session's Registrations tab, where the family's places and payments are.
 */
export function RegistrationSearch({ rows }: { rows: readonly RegistrationSearchRow[] }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? rows.filter(row => [row.camperName, row.formName, row.sessionName].some(v => v.toLowerCase().includes(needle)))
    : rows;

  return (
    <div className="stack">
      <SearchField
        aria-label="Search registrations"
        placeholder="Search by camper, form or session"
        value={query}
        onChange={setQuery}
      />
      {rows.length === 0 ? (
        <Empty
          icon="list"
          title="No registrations yet"
          body="Registrations appear here once a family has been registered."
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
                  </td>
                  <td>{row.submitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

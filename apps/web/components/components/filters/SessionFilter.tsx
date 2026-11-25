'use client';

import { useRef } from 'react';
import { SESSION_PARAM, sessionFilterOptions, type SessionChoice } from '@buxa/shared';
import { Select } from '@/components/atoms';

/**
 * The session filter at the top of a camp-wide list: one select, All sessions first, then each session. It is a GET form, so the
 * choice is in the address (`?session=<id>`) and refresh and back keep it. Choosing a session submits the form.
 */
export function SessionFilter({
  action,
  sessions,
  value,
}: {
  /** The page the filter submits to (the list's own address). */
  action: string;
  sessions: readonly SessionChoice[];
  /** The session the list shows now. */
  value: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      role="search"
      aria-label="Filter by session"
      className="session-filter"
    >
      <Select
        label="Session"
        hideLabel
        name={SESSION_PARAM}
        defaultValue={value}
        options={sessionFilterOptions(sessions)}
        onChange={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}

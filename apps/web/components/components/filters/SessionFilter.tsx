'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SESSION_PARAM, sessionFilterOptions, type SessionChoice } from '@buxa/shared';
import { Select } from '@/components/atoms';

/**
 * The session filter at the top of a camp-wide list: one select, All sessions first, then each session. The choice is in the address
 * (`?session=<id>`), so refresh and back keep it. Choosing a session moves to that address inside the app, without reloading the page,
 * so the list updates in place. A form still wraps it, so the select keeps its form role and Enter does nothing unexpected.
 */
export function SessionFilter({
  action,
  sessions,
  value,
}: {
  /** The list's own address; the choice is added to it as `?session=<id>`. */
  action: string;
  sessions: readonly SessionChoice[];
  /** The session the list shows now. */
  value: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [, startTransition] = useTransition();

  const choose = (next: string | null) => {
    const id = next ?? '';
    setCurrent(id);
    const url = id ? `${action}?${SESSION_PARAM}=${encodeURIComponent(id)}` : action;
    startTransition(() => router.replace(url, { scroll: false }));
  };

  return (
    <form
      role="search"
      aria-label="Filter by session"
      className="session-filter"
      onSubmit={event => event.preventDefault()}
    >
      <Select
        label="Session"
        hideLabel
        name={SESSION_PARAM}
        value={current}
        options={sessionFilterOptions(sessions)}
        onChange={choose}
      />
    </form>
  );
}
